/**
 * The real Instagram port: Instagram's API with Instagram Login, called with plain HTTPS as Google is
 * (Instagram Reels spec IG-FR-02 to IG-FR-06; docs/decisions/2026-10-11-instagram-login-read-only.md).
 * One permission is ever asked for, to read the account's own profile and media, and every call but
 * the exchange of a code is a GET (IG-BR-01). A token, a code, the app's secret and an account's name
 * are never logged or put in an error (IG-BR-02, IG-BR-12).
 *
 * Reading the account and renewing a token are as the by-hand check saw Instagram answer
 * (`pnpm test:instagram`). The exchange of a code is as Meta documents it and is not yet proven.
 */
import type { InstagramAccount, InstagramPort, InstagramToken } from "./port";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const CODE_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";
/** The one permission: reading the account's own profile and media. */
const SCOPE = "instagram_business_basic";
const TIMEOUT_MS = 15_000;
/** Meta's code for a token it no longer takes: revoked, expired or not one of its own. */
const TOKEN_REFUSED = 190;
const PROFESSIONAL = ["BUSINESS", "MEDIA_CREATOR"];

type Json = Record<string, unknown>;

export function createInstagramApi(config: {
  appId: string;
  appSecret: string;
  now?: () => Date;
  /** Told how each call went: what was asked, a status and a timing. Never a token, a code or anything from the account. */
  log?: (message: string, details: Record<string, unknown>) => void;
  /** The network. Tests pass a stand-in. */
  fetch?: typeof fetch;
}): InstagramPort {
  const send = config.fetch ?? fetch;
  const now = config.now ?? (() => new Date());

  /** One call. A network failure becomes an error that carries nothing of what was sent. */
  async function call(what: string, url: string, init: RequestInit = {}): Promise<{ status: number; body: Json }> {
    const started = Date.now();
    let response: Response;
    try {
      response = await send(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      config.log?.("Instagram could not be reached", { what, ms: Date.now() - started });
      throw new Error(`Instagram could not be reached for ${what}`);
    }
    const body = ((await response.json().catch(() => ({}))) ?? {}) as Json;
    config.log?.("Instagram was asked", { what, status: response.status, ms: Date.now() - started });
    return { status: response.status, body };
  }

  const read = (what: string, path: string, params: Record<string, string>) => call(what, `${GRAPH}${path}?${new URLSearchParams(params)}`, { method: "GET" });

  /** Whether Instagram's answer says the token itself is no good, as opposed to Instagram failing. */
  const tokenRefused = (answer: { status: number; body: Json }) => answer.status >= 400 && answer.status < 500 && (answer.body.error as { code?: unknown } | undefined)?.code === TOKEN_REFUSED;

  /** A token with its end, from an answer that carries both. */
  function tokenIn(body: Json): InstagramToken | undefined {
    const { access_token: token, expires_in: seconds } = body;
    if (typeof token !== "string" || !token || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return undefined;
    return { token, expiresAt: new Date(now().getTime() + seconds * 1000) };
  }

  return {
    signInUrl({ state, redirectUri }) {
      return `${AUTHORIZE_URL}?${new URLSearchParams({ client_id: config.appId, redirect_uri: redirectUri, response_type: "code", scope: SCOPE, state })}`;
    },

    async exchange({ code, redirectUri }) {
      try {
        const first = await call("a code", CODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          // Instagram ends the code with "#_" in the address it sends the browser back to.
          body: new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code: code.replace(/#_$/, "") }).toString(),
        });
        // The answer is the token itself, or a list holding it.
        const given = (Array.isArray(first.body.data) ? first.body.data[0] : first.body) as Json | undefined;
        const short = given?.access_token;
        if (first.status !== 200 || typeof short !== "string" || !short) return { ok: false };
        const granted = Array.isArray(given?.permissions) ? given.permissions : typeof given?.permissions === "string" ? given.permissions.split(",") : undefined;
        if (granted && !granted.includes(SCOPE)) return { ok: false };

        const long = await read("a lasting token", "/access_token", { grant_type: "ig_exchange_token", client_secret: config.appSecret, access_token: short });
        const token = long.status === 200 ? tokenIn(long.body) : undefined;
        return token ? { ok: true, ...token } : { ok: false };
      } catch {
        return { ok: false };
      }
    },

    async account(token): Promise<InstagramAccount | "no_access"> {
      const answer = await read("an account", "/me", { fields: "user_id,username,account_type", access_token: token });
      if (tokenRefused(answer)) return "no_access";
      if (answer.status !== 200) throw new Error(`Instagram answered ${answer.status} for an account`);
      const id = answer.body.user_id ?? answer.body.id;
      const { username, account_type: type } = answer.body;
      if ((typeof id !== "string" && typeof id !== "number") || typeof username !== "string" || !username) throw new Error("Instagram's answer for an account was not in the shape it documents");
      return { id: String(id), username: username.slice(0, 120), professional: typeof type === "string" && PROFESSIONAL.includes(type) };
    },

    async renew(token) {
      const answer = await read("a renewed token", "/refresh_access_token", { grant_type: "ig_refresh_token", access_token: token });
      if (tokenRefused(answer)) return "no_access";
      const renewed = answer.status === 200 ? tokenIn(answer.body) : undefined;
      if (!renewed) throw new Error(`Instagram answered ${answer.status} for a renewed token`);
      return renewed;
    },
  };
}
