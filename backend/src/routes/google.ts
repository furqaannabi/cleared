/**
 * Signing in with Google, and connecting a YouTube channel (deal set-up spec DS-FR-01, DS-FR-04, DS-FR-11,
 * DS-FR-12). Both are a trip to Google and back. What the trip started with is kept in the browser, in a
 * short-lived cookie the page cannot read, and Google's answer is used only if it matches.
 */
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { timingSafeEqual } from "node:crypto";
import type { Accounts } from "../accounts/accounts";
import type { GooglePort, GoogleScope } from "../google/port";
import { cookieOptions, ownPath, sessionToken, signIn, type AppEnv } from "../http/http";
import type { Secrets } from "../secrets/secrets";
import type { Sessions } from "../sessions/sessions";
import { NextSchema } from "./shared";

const PENDING_COOKIE = "cleared_pending";
/** How long a visitor has at Google's screen before the trip has to be started again. */
const PENDING_SECONDS = 10 * 60;

/** What a trip to Google started with. */
interface Pending {
  purpose: "sign_in" | "youtube";
  state: string;
  verifier: string;
  nonce: string;
  next?: string;
  /** Who started connecting an account. The answer is used only if the same creator is still signed in. */
  creatorId?: string;
}

const random = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

/** The proof key Google is given at the start; the verifier it came from is shown only when the code is exchanged. */
const challengeOf = (verifier: string) =>
  Buffer.from(new Bun.CryptoHasher("sha256").update(verifier).digest()).toString("base64url");

/** Compares two values without the time taken giving away how much of them matched. */
function same(expected: string, given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerGoogleRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: {
    /** Undefined when Google sign-in is not set up. */
    google?: GooglePort;
    /** Undefined when no key is set up. Without it no channel can be connected. */
    secrets?: Secrets;
    sessions: Sessions;
    accounts: Accounts;
    appOrigin: string;
    apiOrigin: string;
    sessionDays: number;
  },
) {
  const { google, secrets, sessions, accounts, appOrigin, apiOrigin } = deps;
  const toApp = (c: Context, path: string) => c.redirect(`${appOrigin}${path}`, 303);

  /** Sends the browser to Google, remembering what the trip started with. */
  function leave(
    c: Context,
    port: GooglePort,
    purpose: Pending["purpose"],
    scope: GoogleScope,
    redirectUri: string,
    creatorId?: string,
  ) {
    const pending: Pending = {
      purpose,
      creatorId,
      state: random(),
      verifier: random(),
      nonce: random(),
      next: ownPath(c.req.query("next"), appOrigin),
    };
    setCookie(c, PENDING_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
      ...cookieOptions(appOrigin),
      maxAge: PENDING_SECONDS,
    });
    const url = port.signInUrl({
      scope,
      state: pending.state,
      nonce: pending.nonce,
      codeChallenge: challengeOf(pending.verifier),
      redirectUri,
    });
    return c.redirect(url, 302);
  }

  /**
   * What this browser's trip started with, if Google's answer belongs to it. The cookie is removed
   * whatever the outcome, so an answer works once.
   */
  function back(c: Context, purpose: Pending["purpose"]): Pending | undefined {
    const stored = getCookie(c, PENDING_COOKIE);
    deleteCookie(c, PENDING_COOKIE, cookieOptions(appOrigin));
    if (!stored) return undefined;
    try {
      const pending = JSON.parse(Buffer.from(stored, "base64url").toString()) as Partial<Pending>;
      if (pending.purpose !== purpose) return undefined;
      if (typeof pending.state !== "string" || typeof pending.verifier !== "string" || typeof pending.nonce !== "string") {
        return undefined;
      }
      if (!same(pending.state, c.req.query("state"))) return undefined;
      return pending as Pending;
    } catch {
      return undefined;
    }
  }

  const signInCallback = `${apiOrigin}/auth/google/callback`;

  // Pages the browser is sent to have no JSON answer to check, so they are described for the contract
  // and handled as plain routes (DS-FR-47). The two callbacks are Google's to call, and are not in it.
  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/auth/google",
    summary: "Sign in with Google: the browser is sent here, on to Google, and back into the app (DS-FR-01)",
    request: { query: NextSchema },
    responses: { 302: { description: "To Google; afterwards to `next`, /deals or /welcome, or to /sign-in?problem=… if it did not work" } },
  });
  app.openAPIRegistry.registerPath({
    method: "get",
    path: "/connect/youtube",
    summary: "Connect the creator's YouTube channel, read-only: the browser is sent here, on to Google, and back (DS-FR-11)",
    request: { query: NextSchema },
    responses: {
      302: { description: "To Google; afterwards to `next` or /deals with `connected=youtube`, or `connect=failed`, `declined` or `no_channel`" },
    },
  });

  app.get("/auth/google", (c) => {
    if (!google) return toApp(c, "/sign-in?problem=not_configured");
    return leave(c, google, "sign_in", "identity", signInCallback);
  });

  app.get("/auth/google/callback", async (c) => {
    const pending = back(c, "sign_in");
    if (!google) return toApp(c, "/sign-in?problem=not_configured");
    if (!pending) return toApp(c, "/sign-in?problem=google");
    // The visitor pressed cancel on Google's screen.
    if (c.req.query("error")) return toApp(c, "/sign-in?problem=cancelled");
    const code = c.req.query("code");
    if (!code) return toApp(c, "/sign-in?problem=google");

    const exchanged = await google.exchange({
      code,
      codeVerifier: pending.verifier,
      nonce: pending.nonce,
      redirectUri: signInCallback,
    });
    if (!exchanged.ok || !exchanged.identity.emailVerified) return toApp(c, "/sign-in?problem=google");

    const { googleId, name, email } = exchanged.identity;
    const { creatorId } = await accounts.signInWithGoogle({ googleId, name, email });
    signIn(c, await sessions.start(creatorId), appOrigin, deps.sessionDays);
    // A first sign-in lands on the welcome page; a later one where they were going (DS-FR-04).
    const welcomed = (await accounts.profile(creatorId))?.welcomed;
    return toApp(c, welcomed ? (pending.next ?? "/deals") : "/welcome");
  });

  const connectCallback = `${apiOrigin}/connect/youtube/callback`;

  /** Who is signed in on this browser, if anyone. */
  const signedIn = async (c: Context) => {
    const token = sessionToken(c);
    return token ? (await sessions.find(token))?.creatorId : undefined;
  };

  /** Sends the browser back to the page it came from, saying how connecting went. */
  const connectResult = (c: Context, next: string | undefined, key: "connected" | "connect", value: string) => {
    const url = new URL(next ?? "/deals", appOrigin);
    url.searchParams.set(key, value);
    return toApp(c, `${url.pathname}${url.search}${url.hash}`);
  };

  app.get("/connect/youtube", async (c) => {
    const next = ownPath(c.req.query("next"), appOrigin);
    const creatorId = await signedIn(c);
    // The page navigated here, so someone signed out is sent to sign in, not shown an error.
    if (!creatorId) return toApp(c, `/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    if (!google || !secrets) return connectResult(c, next, "connect", "failed");
    return leave(c, google, "youtube", "youtube", connectCallback, creatorId);
  });

  app.get("/connect/youtube/callback", async (c) => {
    const pending = back(c, "youtube");
    const next = pending?.next;
    const failed = (reason: "failed" | "declined" | "no_channel") => connectResult(c, next, "connect", reason);
    if (!google || !secrets || !pending) return failed("failed");
    // Someone else has signed in on this browser since the trip started.
    const creatorId = await signedIn(c);
    if (!creatorId || creatorId !== pending.creatorId) return failed("failed");
    if (c.req.query("error")) return failed("declined");
    const code = c.req.query("code");
    if (!code) return failed("failed");

    const exchanged = await google.exchange({
      code,
      codeVerifier: pending.verifier,
      nonce: pending.nonce,
      redirectUri: connectCallback,
    });
    if (!exchanged.ok) return failed("failed");
    // The creator can untick YouTube access on Google's screen (DS-FR-12).
    if (!exchanged.youtube) return failed("declined");
    if (!exchanged.refreshToken) return failed("failed");
    const channel = await google.channel(exchanged.accessToken);
    if (channel === "none") return failed("no_channel");
    if (channel === "unavailable") return failed("failed");

    await accounts.connectYouTube(creatorId, {
      externalId: channel.id,
      name: channel.name,
      // Encrypted here, so the token is never stored or logged in the clear (DS-BR-14).
      refreshTokenEncrypted: await secrets.encrypt(exchanged.refreshToken),
    });
    return connectResult(c, next, "connected", "youtube");
  });
}
