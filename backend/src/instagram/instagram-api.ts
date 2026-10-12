/**
 * The real Instagram port: Instagram's API with Instagram Login, called with plain HTTPS as Google is
 * (Instagram Reels spec IG-FR-02 to IG-FR-06; docs/decisions/2026-10-11-instagram-login-read-only.md).
 * One permission is ever asked for, to read the account's own profile and media, and every call but
 * the exchange of a code is a GET (IG-BR-01). A token, a code, the app's secret and an account's name
 * are never logged or put in an error (IG-BR-02, IG-BR-12).
 *
 * Reading the account and renewing a token are as the by-hand check saw Instagram answer
 * (`pnpm test:instagram`). The exchange of a code, and everything about an account's media (its
 * fields, how the next page is asked for, what a Reel that is gone answers), are as Meta documents
 * them and are not yet proven: the tester account had no media to read.
 */
import type { InstagramAccount, InstagramMedia, InstagramPort, InstagramToken } from "./port";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const CODE_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";
/** The one permission: reading the account's own profile and media. */
const SCOPE = "instagram_business_basic";
const TIMEOUT_MS = 15_000;
/** Meta's code for a token it no longer takes: revoked, expired or not one of its own. */
const TOKEN_REFUSED = 190;
const PROFESSIONAL = ["BUSINESS", "MEDIA_CREATOR"];
/** Meta's code for an object that does not exist, or that this token may not read. */
const NO_SUCH_OBJECT = 100;
const MEDIA_FIELDS = "id,shortcode,permalink,media_type,media_product_type,timestamp,caption,media_url";
/** The most Instagram returns in one listing. */
const PAGE = 100;
const MEDIA_ID = /^\d{5,30}$/;
const INSTAGRAM_HOSTS = new Set(["www.instagram.com", "instagram.com"]);

/** An https address, or nothing. With `hosts`, only one on those hosts. */
function httpsAddress(value: unknown, hosts?: Set<string>): string | undefined {
  if (typeof value !== "string" || value.length > 4000 || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  return !hosts || hosts.has(url.hostname) ? value : undefined;
}

/** One of an account's media, from Instagram's own description of it. Nothing if it is not in the shape Meta documents. */
function mediaFrom(item: unknown): InstagramMedia | undefined {
  const { id, shortcode, permalink, media_product_type: kind, timestamp, caption, media_url: video } = (item ?? {}) as Record<string, unknown>;
  if ((typeof id !== "string" && typeof id !== "number") || typeof shortcode !== "string" || !shortcode) return undefined;
  const link = httpsAddress(permalink, INSTAGRAM_HOSTS);
  const postedAt = typeof timestamp === "string" ? new Date(timestamp) : undefined;
  const videoUrl = httpsAddress(video);
  return {
    id: String(id),
    shortCode: shortcode,
    isReel: kind === "REELS",
    ...(link ? { link } : {}),
    ...(postedAt && !Number.isNaN(postedAt.getTime()) ? { postedAt } : {}),
    // Untrusted text, kept to Instagram's own limit. It is searched and quoted, never obeyed (IG-BR-09).
    caption: typeof caption === "string" ? caption.slice(0, 2200) : "",
    ...(videoUrl ? { videoUrl } : {}),
  };
}

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

    async findMedia(token, shortCode, searched) {
      let after: string | undefined;
      for (let seen = 0; seen < searched; ) {
        const answer = await read("an account's media", "/me/media", { fields: MEDIA_FIELDS, limit: String(Math.min(PAGE, searched - seen)), ...(after ? { after } : {}), access_token: token });
        if (tokenRefused(answer)) return "no_access";
        if (answer.status !== 200 || !Array.isArray(answer.body.data)) throw new Error(`Instagram answered ${answer.status} for an account's media`);
        for (const item of answer.body.data) {
          const media = mediaFrom(item);
          if (media?.shortCode === shortCode) return media;
        }
        seen += answer.body.data.length;
        // The next page is asked for by the cursor alone. An address Instagram sends is never followed.
        const next = (answer.body.paging as { cursors?: { after?: unknown } } | undefined)?.cursors?.after;
        if (answer.body.data.length === 0 || typeof next !== "string" || !next) break;
        after = next;
      }
      return "not_found";
    },

    async media(token, mediaId) {
      // An id is only ever one of Instagram's own. Anything else is no media, and goes nowhere.
      if (!MEDIA_ID.test(mediaId)) return "not_found";
      const answer = await read("one of an account's media", `/${mediaId}`, { fields: MEDIA_FIELDS, access_token: token });
      if (tokenRefused(answer)) return "no_access";
      const code = (answer.body.error as { code?: unknown } | undefined)?.code;
      if (answer.status === 404 || (answer.status === 400 && code === NO_SUCH_OBJECT)) return "not_found";
      const media = answer.status === 200 ? mediaFrom(answer.body) : undefined;
      if (!media) throw new Error(`Instagram answered ${answer.status} for one of an account's media`);
      return media;
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
