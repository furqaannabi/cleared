/**
 * Connecting an Instagram account (Instagram Reels spec IG-FR-02 to IG-FR-05). It is a trip to
 * Instagram and back, run by the backend. What the trip started with is kept in the browser, in a
 * short-lived cookie the page cannot read, and Instagram's answer is used only if it matches and the
 * same creator is still signed in (IG-BR-10). The token never reaches the browser (IG-BR-02).
 */
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { timingSafeEqual } from "node:crypto";
import { cookieOptions, ownPath, sessionToken, type AppEnv } from "../http/http";
import type { InstagramConnections } from "../instagram/connections";
import type { InstagramPort } from "../instagram/port";
import type { Sessions } from "../sessions/sessions";
import { NextSchema } from "./shared";

/** Its own cookie, so a trip to Google and a trip to Instagram cannot be mistaken for each other. */
const PENDING_COOKIE = "cleared_pending_instagram";
/** How long a creator has at Instagram's screen before the trip has to be started again. */
const PENDING_SECONDS = 10 * 60;

/** What a trip to Instagram started with. */
interface Pending {
  state: string;
  /** Who started it. The answer is used only if the same creator is still signed in. */
  creatorId: string;
  next?: string;
}

const random = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

/** Compares two values without the time taken giving away how much of them matched. */
function same(expected: string, given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerInstagramRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: {
    /** Undefined when Instagram is not set up. */
    instagram?: InstagramPort;
    /** Undefined when Instagram, or the key tokens are encrypted with, is not set up. */
    connections?: Pick<InstagramConnections, "store">;
    sessions: Sessions;
    appOrigin: string;
    apiOrigin: string;
  },
) {
  const { instagram, connections, sessions, appOrigin, apiOrigin } = deps;
  const callback = `${apiOrigin}/connect/instagram/callback`;
  const toApp = (c: Context, path: string) => c.redirect(`${appOrigin}${path}`, 303);

  /** Sends the browser back to the page it came from, saying how connecting went. */
  const result = (c: Context, next: string | undefined, key: "connected" | "connect", value: string) => {
    const url = new URL(next ?? "/deals", appOrigin);
    url.searchParams.set(key, value);
    return toApp(c, `${url.pathname}${url.search}${url.hash}`);
  };

  /** Who is signed in on this browser, if anyone. */
  const signedIn = async (c: Context) => {
    const token = sessionToken(c);
    return token ? (await sessions.find(token))?.creatorId : undefined;
  };

  // A page the browser is sent to has no JSON answer, so it is described for the contract and handled
  // as a plain route. The callback is Instagram's to call, and is not in it.
  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/connect/instagram",
    summary: "Connect the creator's Instagram account, read-only: the browser is sent here, on to Instagram, and back (IG-FR-02)",
    request: { query: NextSchema },
    responses: {
      302: { description: "To Instagram; afterwards to `next` or /deals with `connected=instagram`, or `connect=failed`, `declined` or `not_professional`" },
    },
  });

  app.get("/connect/instagram", async (c) => {
    const next = ownPath(c.req.query("next"), appOrigin);
    const creatorId = await signedIn(c);
    // The page navigated here, so someone signed out is sent to sign in, not shown an error.
    if (!creatorId) return toApp(c, `/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    if (!instagram || !connections) return result(c, next, "connect", "failed");

    const pending: Pending = { state: random(), creatorId, next };
    setCookie(c, PENDING_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), { ...cookieOptions(appOrigin), maxAge: PENDING_SECONDS });
    return c.redirect(instagram.signInUrl({ state: pending.state, redirectUri: callback }), 302);
  });

  app.get("/connect/instagram/callback", async (c) => {
    // What this browser's trip started with. The cookie is removed whatever the outcome, so an answer works once.
    const kept = getCookie(c, PENDING_COOKIE);
    deleteCookie(c, PENDING_COOKIE, cookieOptions(appOrigin));
    let pending: Pending | undefined;
    try {
      const read = kept ? (JSON.parse(Buffer.from(kept, "base64url").toString()) as Partial<Pending>) : undefined;
      if (read && typeof read.state === "string" && typeof read.creatorId === "string" && same(read.state, c.req.query("state"))) pending = read as Pending;
    } catch {
      pending = undefined;
    }
    const next = ownPath(pending?.next, appOrigin);
    const failed = (reason: "failed" | "declined" | "not_professional") => result(c, next, "connect", reason);
    if (!instagram || !connections || !pending) return failed("failed");
    // Someone else has signed in on this browser since the trip started.
    if ((await signedIn(c)) !== pending.creatorId) return failed("failed");
    if (c.req.query("error")) return failed("declined");
    const code = c.req.query("code");
    if (!code) return failed("failed");

    const exchanged = await instagram.exchange({ code, redirectUri: callback });
    if (!exchanged.ok) return failed("failed");
    let account;
    try {
      account = await instagram.account(exchanged.token);
    } catch {
      return failed("failed");
    }
    if (account === "no_access") return failed("failed");
    // Only a professional account can be connected (IG-FR-03).
    if (!account.professional) return failed("not_professional");

    await connections.store(pending.creatorId, account, exchanged);
    return result(c, next, "connected", "instagram");
  });
}
