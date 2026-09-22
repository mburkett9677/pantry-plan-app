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
      url = absoluteUrl(loc