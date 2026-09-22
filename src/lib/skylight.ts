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
    if (/name="email"/i.test(html) || /invalid|incorrect|unable t