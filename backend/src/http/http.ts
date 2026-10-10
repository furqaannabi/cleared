/** What every route shares: the session cookie, the one error shape, and who is calling. */
import { z } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Sessions } from "../sessions/sessions";

/** The variables a route can read once its middleware has run. */
export interface AppEnv {
  Variables: { creatorId: string };
}

export const SESSION_COOKIE = "cleared_session";

/** A brand's session cookie has the deal in its name, so one browser can hold several deals' sessions. */
const brandCookie = (dealId: string) => `cleared_brand_${dealId}`;
/** The only routes a brand's cookie is sent to: its own deal's. */
const brandPath = (dealId: string) => `/brand/deals/${dealId}`;

/** One shape for every error (DS-FR-48): a code, and the field it is about where there is one. */
export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      field: z.string().optional(),
      /** When a daily limit lifts, for a refusal that is about one (DS-FR-28). */
      resetsAt: z.string().optional(),
      /** For a draft that is too long: how long it is and how long it may be, in seconds (DR-FR-03). */
      lengthSec: z.number().optional(),
      lengthCapSec: z.number().optional(),
      /** For a post that was already cancelled: who cancelled it (PT-FR-29). */
      by: z.enum(["creator", "brand"]).optional(),
    }),
  })
  .openapi("Error");

export const fail = <Status extends ContentfulStatusCode>(c: Context, status: Status, code: string, field?: string) =>
  c.json({ error: { code, field } }, status);

/** The cookie's attributes. The page cannot read it, and it is only ever sent over HTTPS (DS-BR-02). */
export function cookieOptions(appOrigin: string) {
  // Browsers other than Chrome refuse a Secure cookie on plain http://localhost, so it is relaxed there only.
  const local = appOrigin.startsWith("http://localhost");
  return { httpOnly: true, secure: !local, sameSite: "Lax", path: "/" } as const;
}

export function signIn(c: Context, token: string, appOrigin: string, days: number) {
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(appOrigin), maxAge: days * 24 * 60 * 60 });
}

export function signOut(c: Context, appOrigin: string) {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(appOrigin));
}

export const sessionToken = (c: Context) => getCookie(c, SESSION_COOKIE);

/**
 * Gives a brand's browser its session for one deal (DS-FR-34). The cookie is sent to that deal's routes
 * only, and the browser drops it after `seconds`, when the link it came from expires.
 */
export function letBrandIn(c: Context, dealId: string, token: string, appOrigin: string, seconds: number) {
  setCookie(c, brandCookie(dealId), token, { ...cookieOptions(appOrigin), path: brandPath(dealId), maxAge: seconds });
}

/**
 * Refuses a changing request unless it comes from Cleared's own app (DS-BR-03): its origin must be the
 * app's address, and a body must be JSON. This is on top of the SameSite cookie. `open` lists the paths
 * that are called by someone other than the app's scripts: PayPal, and the page's own form posts. It
 * also lists the paths whose body is a file: they must still come from the app's own address.
 */
export function ownAppOnly(appOrigin: string, open: { noOrigin: string[]; forms: string[]; files: RegExp[] }): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") return next();
    if (open.noOrigin.includes(c.req.path)) return next();
    if (c.req.header("origin") !== appOrigin) return fail(c, 403, "wrong_origin");
    const type = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
    const exempt = open.forms.includes(c.req.path) || open.files.some((path) => path.test(c.req.path));
    if (type && type !== "application/json" && !exempt) return fail(c, 415, "not_json");
    return next();
  };
}

/**
 * A path on Cleared's own app to send the browser to, or undefined if `next` is anything else
 * (DS-FR-04). It never returns an address on another site.
 */
export function ownPath(next: string | undefined, appOrigin: string): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined;
  // Browsers read a backslash as a slash, and a control character can split a header.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return undefined;
  if (!URL.canParse(next, appOrigin)) return undefined;
  const url = new URL(next, appOrigin);
  return url.origin === appOrigin ? `${url.pathname}${url.search}${url.hash}` : undefined;
}

/** Lets a request through only with a live creator session, and tells the route who it is (DS-BR-01). */
export function requireCreator(sessions: Sessions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = sessionToken(c);
    const session = token ? await sessions.find(token) : undefined;
    if (!session) return fail(c, 401, "signed_out");
    c.set("creatorId", session.creatorId);
    await next();
  };
}

/**
 * Lets a request through only with a brand's session for the deal in its path (DS-BR-01). Anything
 * else is "not signed in", whether or not the deal exists (DS-FR-37).
 */
export function requireBrand(sessions: Sessions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const dealId = c.req.param("dealId");
    const token = dealId ? getCookie(c, brandCookie(dealId)) : undefined;
    if (!dealId || !token || !(await sessions.isBrandOf(token, dealId))) return fail(c, 401, "signed_out");
    await next();
  };
}
