/**
 * A session for end-to-end tests (account and history spec AH-FR-25 to AH-FR-29;
 * docs/decisions/2026-10-12-a-test-session-behind-a-secret.md). It signs a test runner in without a
 * person at Google's screen, so it is the one way into the app that is not Google. What keeps it safe:
 *
 * - It exists only when the server was given a secret of at least 32 characters. Otherwise nothing
 *   is registered at all.
 * - The secret, in a header, is the way in. Anything else, a wrong secret, none, another method, is
 *   passed on untouched to what would have answered had this not been here: the same answer, byte for
 *   byte, as a path that does not exist (AH-FR-26).
 * - It signs in as one fixed creator kept for tests. It reads no name, email or id from the request,
 *   so it can never be anyone else (AH-FR-27).
 * - The secret is never logged, returned or put in an error (AH-BR-09).
 *
 * It is not part of the API's contract: it is no page's to call, and most servers do not have it.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { createAccounts } from "../accounts/accounts";
import type { PrismaClient } from "../generated/prisma/client";
import { signIn, type AppEnv } from "../http/http";
import { createSessions, defaultSessionSettings } from "../sessions/sessions";

export const TEST_SESSION_PATH = "/test/session";
/** A secret shorter than this is no secret, and the route is not registered for it (AH-FR-25). */
export const SECRET_MIN_LENGTH = 32;
const HEADER = "x-test-secret";
/** Google's own ids for people are numbers, so this can never be one of them. */
const TEST_GOOGLE_ID = "cleared:test-session";
const HOUR_MS = 3600 * 1000;

export interface TestSessionConfig {
  secret: string;
  /** How many sessions an hour are made this way, overall (AH-FR-29). */
  perHour?: number;
}

/** Whether a configured secret is long enough to count. One that is not is treated as none. */
export const usable = (config: TestSessionConfig | undefined): config is TestSessionConfig => !!config && config.secret.length >= SECRET_MIN_LENGTH;

/** Compared as two digests of the same length, in constant time, so neither the secret's length nor its start can be felt out. */
function same(secret: string, given: string | undefined): boolean {
  if (given === undefined) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(secret), digest(given));
}

/**
 * The route, as a handler placed ahead of everything that could answer for this path. A request that
 * is not a POST carrying the secret goes on as if this were not here.
 */
export function testSession(deps: {
  prisma: PrismaClient;
  now: () => Date;
  appOrigin: string;
  config: TestSessionConfig;
  /** Told of a session made, and of one refused. Never the secret, nor what was sent in its place. */
  log?: (message: string, details: Record<string, unknown>) => void;
}): MiddlewareHandler<AppEnv> {
  const { prisma, now, appOrigin, config, log } = deps;
  const perHour = config.perHour ?? 120;
  const sessions = createSessions({ prisma, now });
  const accounts = createAccounts({ prisma, now });
  /** When each session of the last hour was made. Kept by this service alone, and begun again when it restarts. */
  let made: number[] = [];

  return async (c, next) => {
    if (c.req.method !== "POST") return next();
    if (!same(config.secret, c.req.header(HEADER))) {
      log?.("A test session was refused", { secretSent: c.req.header(HEADER) !== undefined });
      return next();
    }

    const at = now().getTime();
    made = made.filter((moment) => at - moment < HOUR_MS);
    if (made.length >= perHour) {
      log?.("A test session was refused: the hourly limit was reached", { perHour });
      return c.json({ error: { code: "test_session_limit", resetsAt: new Date(made[0]! + HOUR_MS).toISOString() } }, 429);
    }
    made.push(at);

    // The one creator kept for tests, made the first time. Nothing in the request chooses who this is.
    const creator = await prisma.creator.upsert({ where: { googleId: TEST_GOOGLE_ID }, create: { googleId: TEST_GOOGLE_ID, name: "Test Creator", createdAt: now() }, update: {} });
    signIn(c, await sessions.start(creator.id), appOrigin, defaultSessionSettings.creatorDays);
    log?.("A test session was made", { creatorId: creator.id });
    return c.json(await accounts.profile(creator.id), 200);
  };
}
