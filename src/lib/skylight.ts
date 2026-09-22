/**
 * Skylight Calendar sync via the unofficial private app API (app.ourskylight.com).
 *
 * Auth uses OAuth2 Authorization Code + PKCE (the old password grant and
 * /api/auth/login endpoints are gone and return 404/"Not Found").
 *
 * Personal use against your own account only — Skylight has no public API.
 */

import { createHash, randomBytes } from "crypto";

const APP_BASE = "https://app.ourskylight.com";
const OAUTH_CLIENT_ID = "skylight-mobile";
const OAUTH_REDIRECT_URI = "skylight-family://welcome";
const OAUTH_SCOPE = "everything";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
};

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function mergeCookies(jar: Map<string, string>, setCookie: string[] | undefined) {
  if (!setCookie) return;
  for (const raw of setCookie) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function getSetCookie(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

async function request(
  jar: Map<string, string>,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("User-Agent")) headers.set("User-Agent", BROWSER_UA);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("Cookie", cookie);
  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  mergeCookies(jar, getSetCookie(res.headers));
  return res;
}

function absoluteUrl(location: string) {
  if (location.startsWith("http") || location.includes("://")) return location;
  return `${APP_BASE}${location.startsWith("/") ? "" : "/"}${location}`;
}

function isLoginPageUrl(url: string) {
  return /\/auth\/session\/new(?:\?|$)/.test(url) || /\/login(?:\?|$)/.test(url);
}

async function followUntilHtml(jar: Map<string, string>, startUrl: string) {
  let url = startUrl;
  for (let i = 0; i < 10; i++) {
    const res = await request(jar, url, { method: "GET" });
    const loc = res.headers.get("location");
    if (
      loc &&
      (res.status === 301 ||
        res.status === 302 ||
        res.status === 303 ||
        res.status === 307 ||
        res.status === 308)
    ) {
      if (loc.startsWith("skylight-family:")) {
        return { res, html: "", location: loc, url };
      }
      url = absoluteUrl(loc);
      continue;
    }
    const html = await res.text();
    return { res, html, location: loc, url };
  }
  throw new Error("Skylight login: too many redirects before login form");
}

async function chaseAuthCode(jar: Map<string, string>, first: Response) {
  let loc = first.headers.get("location");
  let res = first;
  for (let i = 0; i < 12; i++) {
    if (loc?.startsWith("skylight-family:")) return loc;

    if (
      loc &&
      (res.status === 301 ||
        res.status === 302 ||
        res.status === 303 ||
        res.status === 307 ||
        res.status === 308)
    ) {
      const next = absoluteUrl(loc);
      if (isLoginPageUrl(next)) {
        throw new Error("Skylight login failed: invalid email or password");
      }
      res = await request(jar, next, { method: "GET" });
      loc = res.headers.get("location");
      continue;
    }

    const body = await res.text();
    if (/name="email"/i.test(body) && /name="password"/i.test(body)) {
      throw new Error("Skylight login failed: invalid email or password");
    }
    throw new Error(
      `Skylight login failed (HTTP ${res.status}). Check email/password. ${body.slice(0, 120)}`,
    );
  }
  throw new Error("Skylight login: never received OAuth redirect with authorization code");
}

async function login(email: string, password: string): Promise<TokenBundle> {
  const jar = new Map<string, string>();
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(18));

  const authorizeUrl =
    `${APP_BASE}/oauth/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URI,
      scope: OAUTH_SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "login",
    }).toString();

  const formPage = await followUntilHtml(jar, authorizeUrl);
  const csrfMatch =
    formPage.html.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
    formPage.html.match(/value="([^"]+)"[^>]*name="authenticity_token"/) ||
    formPage.html.match(/name="csrf-token" content="([^"]+)"/) ||
    formPage.html.match(/csrf-token" content="([^"]+)"/);
  if (!csrfMatch?.[1]) {
    throw new Error("Skylight login: could not load login form / CSRF token");
  }

  const body = new URLSearchParams({
    authenticity_token: csrfMatch[1],
    email,
    password,
  });

  const sessionRes = await request(jar, `${APP_BASE}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml",
      Origin: APP_BASE,
      Referer: `${APP_BASE}/auth/session/new`,
    },
    body,
  });

  // Wrong credentials usually bounce back to the login form (200 or 302).
  if (sessionRes.status === 200) {
    const html = await sessionRes.text();
    if (/name="email"/i.test(html) || /invalid|incorrect|unable to sign/i.test(html)) {
      throw new Error("Skylight login failed: invalid email or password");
    }
    throw new Error(
      `Skylight login failed (HTTP 200): unexpected response ${html.slice(0, 120)}`,
    );
  }

  const redirectLoc = await chaseAuthCode(jar, sessionRes);
  const redirectUrl = new URL(redirectLoc.replace("skylight-family://", "https://skylight-family/"));
  const code = redirectUrl.searchParams.get("code");
  const returnedState = redirectUrl.searchParams.get("state");
  if (!code) throw new Error("Skylight login: missing authorization code");
  if (returnedState && returnedState !== state) {
    throw new Error("Skylight login: OAuth state mismatch");
  }

  const tokenRes = await fetch(`${APP_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OAUTH_CLIENT_ID,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Skylight token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`);
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error("Skylight token exchange returned no access_token");
  }

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
  };
}

async function api(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${APP_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      ...(init?.headers || {}),
    },
  });
}


async function resolveMealCategoryId(
  token: string,
  frameId: string,
  slot: SkylightMealPayload["slot"],
): Promise<string | null> {
  const res = await api(token, `/api/frames/${frameId}/meals/categories`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      attributes?: { name?: string; label?: string; title?: string };
      name?: string;
      label?: string;
      title?: string;
    }>;
  };
  const wanted =
    slot === "breakfast"
      ? ["breakfast"]
      : slot === "lunch"
        ? ["lunch"]
        : slot === "dinner"
          ? ["dinner", "supper"]
          : ["snack", "snacks"];
  const match = (json.data || []).find((c) => {
    const label =
      `${c.attributes?.name || c.name || ""} ${c.attributes?.label || c.label || ""} ${c.attributes?.title || c.title || ""}`.toLowerCase();
    return wanted.some((w) => label.includes(w));
  });
  return match?.id || json.data?.[0]?.id || null;
}

export type SkylightMealPayload = {
  date: string; // YYYY-MM-DD
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  title: string;
  notes?: string | null;
  recipe?: {
    title: string;
    ingredients?: Array<{ name: string; quantity?: string | null; unit?: string | null }>;
    instructions?: string | null;
  };
};

function compactBody<T extends Record<string, unknown>>(body: T) {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

function formatIngredientLine(ing: {
  name: string;
  quantity?: string | null;
  unit?: string | null;
}) {
  const qty = [ing.quantity, ing.unit].filter(Boolean).join(" ").trim();
  return qty ? `${qty} ${ing.name}`.trim() : ing.name.trim();
}

/** Skylight's freeform meal field is one "Instructions or ingredients" box (`note`). */
function buildMealNote(meal: SkylightMealPayload) {
  const ingredientLines = (meal.recipe?.ingredients || [])
    .map(formatIngredientLine)
    .filter(Boolean);
  const instructions = (meal.recipe?.instructions || meal.notes || "").trim();

  const parts: string[] = [];
  if (ingredientLines.length) {
    parts.push(`Ingredients:\n${ingredientLines.map((line) => `• ${line}`).join("\n")}`);
  }
  if (instructions) {
    parts.push(`Instructions:\n${instructions}`);
  }
  return parts.join("\n\n").trim();
}

type SittingListItem = {
  id: string;
  date: string;
  mealCategoryId: string | null;
};

async function listSittingsInRange(
  token: string,
  frameId: string,
  dateMin: string,
  dateMax: string,
): Promise<SittingListItem[]> {
  const qs = new URLSearchParams({
    date_min: dateMin,
    date_max: dateMax,
    include: "meal_category",
  });
  const res = await api(token, `/api/frames/${frameId}/meals/sittings?${qs}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      attributes?: {
        date?: string;
        instances?: Array<{ date?: string } | string>;
      };
      relationships?: {
        meal_cate