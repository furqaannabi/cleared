/**
 * The real Google port (deal set-up spec DS-FR-01, DS-FR-11): Google's sign-in for web servers, and the
 * YouTube Data API, read-only. An identity is accepted only from a token Google signed, for this app,
 * for this sign-in, that has not expired.
 */
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import type { GoogleExchange, GooglePort } from "./port";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
/** Google issues identity tokens under either name. */
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const IDENTITY_SCOPE = "openid email profile";
/** Read-only: Cleared can see the creator's channel and videos, and can change nothing (DS-BR-14). */
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

const TIMEOUT_MS = 15_000;
/** How long Google's published keys are kept before they are fetched again. */
const KEYS_FOR_MS = 60 * 60 * 1000;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  now?: () => Date;
  /** Told about each failed call, with its status only. */
  log?: (message: string, details: Record<string, unknown>) => void;
  /** The `fetch` used for every call. Tests pass a stand-in. */
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

export function createGoogle(config: GoogleConfig): GooglePort {
  const send = config.fetch ?? fetch;
  const now = config.now ?? (() => new Date());
  let keys: { set: ReturnType<typeof createLocalJWKSet>; fetchedAt: number } | undefined;

  /** Google's published signing keys. `fresh` fetches them again, for when Google has rotated them. */
  async function signingKeys(fresh: boolean) {
    if (!fresh && keys && now().getTime() - keys.fetchedAt < KEYS_FOR_MS) return keys.set;
    const response = await send(KEYS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error("Google's signing keys could not be fetched");
    keys = { set: createLocalJWKSet((await response.json()) as JSONWebKeySet), fetchedAt: now().getTime() };
    return keys.set;
  }

  /** The claims of an identity token, if Google signed it for this app and it has not expired. */
  async function verified(idToken: string) {
    const check = async (fresh: boolean) =>
      (await jwtVerify(idToken, await signingKeys(fresh), { issuer: ISSUERS, audience: config.clientId, currentDate: now() }))
        .payload;
    try {
      return await check(false);
    } catch {
      // The key may be newer than the ones held. One more try with fresh keys, then it is refused.
      return check(true);
    }
  }

  return {
    signInUrl({ scope, state, nonce, codeChallenge, redirectUri }) {
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scope === "youtube" ? `${IDENTITY_SCOPE} ${YOUTUBE_SCOPE}` : IDENTITY_SCOPE,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        // A refresh token is only needed for YouTube, and Google only gives one when consent is asked for.
        ...(scope === "youtube" ? { access_type: "offline", prompt: "consent" } : {}),
      }).toString();
      return url.toString();
    },

    async exchange({ code, codeVerifier, nonce, redirectUri }): Promise<GoogleExchange> {
      try {
        const response = await send(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) {
          // The status only. Google's answer can repeat the code it was sent.
          config.log?.("Google refused to exchange a sign-in code", { status: response.status });
          return { ok: false };
        }
        const answer = (await response.json()) as {
          access_token?: unknown;
          id_token?: unknown;
          refresh_token?: unknown;
          scope?: unknown;
        };
        if (typeof answer.id_token !== "string" || typeof answer.access_token !== "string") return { ok: false };

        const claims = await verified(answer.id_token);
        // The token must belong to the sign-in this browser started.
        if (claims.nonce !== nonce) return { ok: false };
        if (typeof claims.sub !== "string" || typeof claims.email !== "string") return { ok: false };
        return {
          ok: true,
          identity: {
            googleId: claims.sub,
            name: typeof claims.name === "string" && claims.name ? claims.name : claims.email,
            email: claims.email,
            emailVerified: claims.email_verified === true,
          },
          accessToken: answer.access_token,
          refreshToken: typeof answer.refresh_token === "string" ? answer.refresh_token : undefined,
          youtube: typeof answer.scope === "string" && answer.scope.split(" ").includes(YOUTUBE_SCOPE),
        };
      } catch {
        // No answer, or an identity token that did not verify. Either way nothing is accepted.
        return { ok: false };
      }
    },

    async channel(accessToken) {
      try {
        const response = await send(CHANNELS_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) {
          config.log?.("YouTube would not return the creator's channel", { status: response.status });
          return "unavailable";
        }
        const answer = (await response.json()) as { items?: { id?: unknown; snippet?: { title?: unknown } }[] };
        const first = answer.items?.[0];
        if (!first || typeof first.id !== "string") return "none";
        return { id: first.id, name: typeof first.snippet?.title === "string" ? first.snippet.title : first.id };
      } catch {
        return "unavailable";
      }
    },
  };
}
