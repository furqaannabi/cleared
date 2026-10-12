/**
 * The real Instagram port, with Instagram's network replaced by a stand-in (Instagram Reels spec
 * IG-FR-02, IG-FR-03, IG-FR-06, IG-BR-01, IG-BR-02, IG-BR-12). The answers the stand-in gives are the
 * ones the by-hand check saw from Instagram itself (`pnpm test:instagram`), where it has seen them.
 */
import { describe, expect, test } from "bun:test";
import { createInstagramApi } from "./instagram-api";

type Answer = { status: number; body?: unknown } | "fails";
const NOW = new Date("2026-10-11T10:00:00Z");
const SIXTY_DAYS = 60 * 24 * 3600;
/** What Instagram answers a token it does not take, as seen by hand. */
const lost: Answer = { status: 400, body: { error: { message: "Invalid OAuth access token - Cannot parse access token for token-sam", type: "OAuthException", code: 190 } } };

/** A Reel as Instagram's API describes one of an account's own media. */
const REEL = {
  id: "18012345678901234",
  shortcode: "DAbC1dEfGhI",
  permalink: "https://www.instagram.com/reel/DAbC1dEfGhI/",
  media_type: "VIDEO",
  media_product_type: "REELS",
  timestamp: "2026-10-12T08:30:00+0000",
  caption: "Two weeks with Glow Serum. Code GLOW20 #GlowPartner",
  media_url: "https://scontent.cdninstagram.com/v/t50/reel.mp4?sig=secret-signature",
};
const PHOTO = { id: "18000000000000001", shortcode: "DPhoto00001", permalink: "https://www.instagram.com/p/DPhoto00001/", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-10-01T08:30:00+0000", caption: "A photo" };
const page = (data: unknown[], after?: string): Answer => ({ status: 200, body: { data, ...(after ? { paging: { cursors: { after }, next: "https://graph.instagram.com/next-page?access_token=token-sam" } } : {}) } });

/** An Instagram that answers each kind of call as the test says, and remembers what it was sent. */
function standIn(answers: { code?: Answer; long?: Answer; me?: Answer; renew?: Answer; list?: Answer[]; one?: Answer } = {}) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const logged: unknown[] = [];
  const reply = (answer: Answer | undefined, fallback: unknown) => {
    if (answer === "fails") throw new Error("socket hang up while sending token-sam and app-secret");
    return new Response(JSON.stringify(answer?.body ?? fallback), { status: answer?.status ?? 200 });
  };
  const instagram = createInstagramApi({
    appId: "app-id",
    appSecret: "app-secret",
    now: () => NOW,
    log: (...parts) => logged.push(parts),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init: init ?? {} });
      if (url.hostname === "api.instagram.com") return reply(answers.code, { access_token: "short-sam", user_id: 17841400000000001, permissions: ["instagram_business_basic"] });
      if (url.pathname === "/access_token") return reply(answers.long, { access_token: "token-sam", token_type: "bearer", expires_in: SIXTY_DAYS });
      if (url.pathname === "/refresh_access_token") return reply(answers.renew, { access_token: "token-sam-2", token_type: "bearer", expires_in: SIXTY_DAYS, permissions: "instagram_business_basic" });
      if (url.pathname === "/me/media") return reply((answers.list ?? [])[calls.filter((call) => call.url.pathname === "/me/media").length - 1], { data: [] });
      if (/^\/\d+$/.test(url.pathname)) return reply(answers.one, REEL);
      return reply(answers.me, { user_id: "17841400000000001", username: "sam.rivera", account_type: "BUSINESS", id: "9000000000000001" });
    }) as typeof fetch,
  });
  return { instagram, calls, logged };
}

describe("IG-FR-02, IG-BR-01 the sign-in address", () => {
  test("Instagram's own sign-in, for this app, asking for one permission: to read the account's profile and media", () => {
    const url = new URL(standIn().instagram.signInUrl({ state: "state-1", redirectUri: "https://api.cleared.test/connect/instagram/callback" }));

    expect(`${url.origin}${url.pathname}`).toBe("https://www.instagram.com/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "app-id",
      redirect_uri: "https://api.cleared.test/connect/instagram/callback",
      response_type: "code",
      scope: "instagram_business_basic",
      state: "state-1",
    });
  });
});

describe("IG-FR-03 exchanging the code", () => {
  test("the code is exchanged with the app's secret, then for a token that lasts 60 days", async () => {
    const { instagram, calls } = standIn();

    expect(await instagram.exchange({ code: "code-1", redirectUri: "https://api.cleared.test/connect/instagram/callback" })).toEqual({
      ok: true,
      token: "token-sam",
      expiresAt: new Date(NOW.getTime() + SIXTY_DAYS * 1000),
    });

    const [first, second] = calls;
    expect(`${first!.url.origin}${first!.url.pathname}`).toBe("https://api.instagram.com/oauth/access_token");
    expect(first!.init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(first!.init.body)))).toEqual({
      client_id: "app-id",
      client_secret: "app-secret",
      grant_type: "authorization_code",
      redirect_uri: "https://api.cleared.test/connect/instagram/callback",
      code: "code-1",
    });
    expect(`${second!.url.origin}${second!.url.pathname}`).toBe("https://graph.instagram.com/access_token");
    expect(Object.fromEntries(second!.url.searchParams)).toEqual({ grant_type: "ig_exchange_token", client_secret: "app-secret", access_token: "short-sam" });
  });

  test("Instagram ends a code with \"#_\" in the browser's address: it is not part of the code", async () => {
    const { instagram, calls } = standIn();

    await instagram.exchange({ code: "code-1#_", redirectUri: "https://api.cleared.test/cb" });

    expect(new URLSearchParams(String(calls[0]!.init.body)).get("code")).toBe("code-1");
  });

  test("the answer may come wrapped in a list, as Instagram's newer answers do", async () => {
    const { instagram } = standIn({ code: { status: 200, body: { data: [{ access_token: "short-sam", user_id: "1", permissions: "instagram_business_basic" }] } } });

    expect(await instagram.exchange({ code: "code-1", redirectUri: "https://api.cleared.test/cb" })).toMatchObject({ ok: true, token: "token-sam" });
  });

  test.each([
    ["a code Instagram refuses", { code: { status: 400, body: { error_type: "OAuthException", code: 400, error_message: "This authorization code has been used" } } }],
    ["an answer with no token", { code: { status: 200, body: {} } }],
    ["an answer without the read permission", { code: { status: 200, body: { access_token: "short-sam", user_id: 1, permissions: ["something_else"] } } }],
    ["a short token Instagram will not exchange", { long: { status: 400, body: {} } }],
    ["a long token with no end", { long: { status: 200, body: { access_token: "token-sam" } } }],
    ["Instagram being down", { code: "fails" }],
  ] as const)("%s connects nothing", async (_what, answers) => {
    const { instagram } = standIn(answers as never);

    expect(await instagram.exchange({ code: "code-1", redirectUri: "https://api.cleared.test/cb" })).toEqual({ ok: false });
  });
});

describe("IG-FR-03 reading the account", () => {
  test("its id, its name, and that it is a professional account", async () => {
    const { instagram, calls } = standIn();

    expect(await instagram.account("token-sam")).toEqual({ id: "17841400000000001", username: "sam.rivera", professional: true });

    expect(`${calls[0]!.url.origin}${calls[0]!.url.pathname}`).toBe("https://graph.instagram.com/me");
    expect(calls[0]!.url.searchParams.get("fields")).toBe("user_id,username,account_type");
    expect(calls[0]!.init.method ?? "GET").toBe("GET");
  });

  test.each([
    ["BUSINESS", true],
    ["MEDIA_CREATOR", true],
    ["PERSONAL", false],
    [undefined, false],
  ])("an account of type %s is professional: %s", async (type, professional) => {
    const { instagram } = standIn({ me: { status: 200, body: { user_id: "1", username: "sam", account_type: type } } });

    expect(await instagram.account("token-sam")).toMatchObject({ professional });
  });

  test("a token Instagram no longer takes is lost access, not a failure", async () => {
    expect(await standIn({ me: lost }).instagram.account("token-sam")).toBe("no_access");
  });

  test.each([
    ["Instagram being down", { me: { status: 500 } }],
    ["a rate limit", { me: { status: 429, body: { error: { code: 4, type: "OAuthException", message: "Application request limit reached" } } } }],
    ["an answer with no id or name", { me: { status: 200, body: { account_type: "BUSINESS" } } }],
    ["no answer at all", { me: "fails" }],
  ] as const)("%s is a failure of Instagram, and is thrown", async (_what, answers) => {
    expect(standIn(answers as never).instagram.account("token-sam")).rejects.toThrow("Instagram");
  });
});

describe("IG-FR-06 renewing a token", () => {
  test("a token that still works is exchanged for one that lasts 60 more days", async () => {
    const { instagram, calls } = standIn();

    expect(await instagram.renew("token-sam")).toEqual({ token: "token-sam-2", expiresAt: new Date(NOW.getTime() + SIXTY_DAYS * 1000) });
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ grant_type: "ig_refresh_token", access_token: "token-sam" });
  });

  test("one that no longer works is lost access; Instagram failing is thrown", async () => {
    expect(await standIn({ renew: lost }).instagram.renew("token-sam")).toBe("no_access");
    expect(standIn({ renew: { status: 503 } }).instagram.renew("token-sam")).rejects.toThrow("Instagram");
  });
});

describe("IG-BR-02, IG-BR-12 nothing of a token, a code, the secret or a name is logged or thrown", () => {
  test.each([
    ["an exchange", {}, (port: ReturnType<typeof standIn>["instagram"]) => port.exchange({ code: "code-1", redirectUri: "https://api.cleared.test/cb" })],
    ["an account read", {}, (port: ReturnType<typeof standIn>["instagram"]) => port.account("token-sam")],
    ["a refusal that repeats the token", { me: lost }, (port: ReturnType<typeof standIn>["instagram"]) => port.account("token-sam")],
    ["a network failure that repeats the token and the secret", { renew: "fails" }, (port: ReturnType<typeof standIn>["instagram"]) => port.renew("token-sam")],
  ] as const)("%s", async (_what, answers, act) => {
    const { instagram, logged } = standIn(answers as never);

    const thrown = await act(instagram).then(
      () => "",
      (error: Error) => error.message,
    );

    for (const secret of ["token-sam", "short-sam", "code-1", "app-secret", "sam.rivera"]) {
      expect(JSON.stringify(logged)).not.toContain(secret);
      expect(thrown).not.toContain(secret);
    }
    expect(logged.length).toBeGreaterThan(0);
  });
});

describe("IG-FR-15, IG-BR-07 finding a Reel among the account's own media", () => {
  const found = {
    id: "18012345678901234",
    shortCode: "DAbC1dEfGhI",
    isReel: true,
    link: "https://www.instagram.com/reel/DAbC1dEfGhI/",
    postedAt: new Date("2026-10-12T08:30:00Z"),
    caption: "Two weeks with Glow Serum. Code GLOW20 #GlowPartner",
    videoUrl: "https://scontent.cdninstagram.com/v/t50/reel.mp4?sig=secret-signature",
  };

  test("the account's own media are listed, newest first, and the one with the short code is returned", async () => {
    const { instagram, calls } = standIn({ list: [page([PHOTO, REEL])] });

    expect(await instagram.findMedia("token-sam", "DAbC1dEfGhI", 100)).toEqual(found);

    expect(`${calls[0]!.url.origin}${calls[0]!.url.pathname}`).toBe("https://graph.instagram.com/me/media");
    expect(calls[0]!.url.searchParams.get("limit")).toBe("100");
    expect(calls[0]!.url.searchParams.get("fields")).toBe("id,shortcode,permalink,media_type,media_product_type,timestamp,caption,media_url");
    expect(calls[0]!.init.method ?? "GET").toBe("GET");
  });

  test("a short code that is not among them is not found: someone else's Reel can never be", async () => {
    const { instagram } = standIn({ list: [page([PHOTO, REEL])] });

    expect(await instagram.findMedia("token-sam", "SomeoneElses", 100)).toBe("not_found");
  });

  test("a post that is not a Reel is found, and said not to be one", async () => {
    const { instagram } = standIn({ list: [page([PHOTO])] });

    expect(await instagram.findMedia("token-sam", "DPhoto00001", 100)).toMatchObject({ id: "18000000000000001", isReel: false, caption: "A photo" });
  });

  test("the next page is asked for by Instagram's cursor, never by following an address it sent, and no more than the number searched is read", async () => {
    const many = (from: number) => Array.from({ length: 50 }, (_, index) => ({ ...PHOTO, id: String(18000000000000100 + from + index), shortcode: `Photo${from + index}` }));
    const { instagram, calls } = standIn({ list: [page(many(0), "cursor-1"), page(many(50), "cursor-2"), page([REEL])] });

    expect(await instagram.findMedia("token-sam", "DAbC1dEfGhI", 100)).toBe("not_found");

    expect(calls).toHaveLength(2);
    expect(calls[1]!.url.pathname).toBe("/me/media");
    expect(calls[1]!.url.searchParams.get("after")).toBe("cursor-1");
  });

  test("a token Instagram no longer takes is lost access; Instagram failing is thrown", async () => {
    expect(await standIn({ list: [lost] }).instagram.findMedia("token-sam", "DAbC1dEfGhI", 100)).toBe("no_access");
    expect(standIn({ list: [{ status: 500 }] }).instagram.findMedia("token-sam", "DAbC1dEfGhI", 100)).rejects.toThrow("Instagram");
    expect(standIn({ list: [{ status: 200, body: { data: "not a list" } }] }).instagram.findMedia("token-sam", "DAbC1dEfGhI", 100)).rejects.toThrow("Instagram");
  });
});

describe("IG-FR-19 one Reel's record, read by its id", () => {
  test("its caption, its date, and where its video can be fetched", async () => {
    const { instagram, calls } = standIn();

    expect(await instagram.media("token-sam", "18012345678901234")).toMatchObject({ id: "18012345678901234", isReel: true, caption: REEL.caption, videoUrl: REEL.media_url });
    expect(calls[0]!.url.pathname).toBe("/18012345678901234");
  });

  test("a Reel with licensed music comes back with no address for its video", async () => {
    const { media_url: _none, ...withMusic } = REEL;
    const { instagram } = standIn({ one: { status: 200, body: withMusic } });

    expect(await instagram.media("token-sam", REEL.id)).not.toHaveProperty("videoUrl");
  });

  test("an address for the video that is not https, and a link that is not on Instagram's own address, are left out", async () => {
    const { instagram } = standIn({ one: { status: 200, body: { ...REEL, media_url: "http://169.254.169.254/latest/meta-data", permalink: "https://evil.example/reel/DAbC1dEfGhI/" } } });

    const read = await instagram.media("token-sam", REEL.id);

    expect(read).not.toHaveProperty("videoUrl");
    expect(read).not.toHaveProperty("link");
  });

  test("a Reel with no caption has an empty one", async () => {
    const { caption: _none, ...bare } = REEL;

    expect(await standIn({ one: { status: 200, body: bare } }).instagram.media("token-sam", REEL.id)).toMatchObject({ caption: "" });
  });

  test("a Reel that is gone is not found; lost access and a failure are told apart from it", async () => {
    const gone: Answer = { status: 400, body: { error: { message: "Unsupported get request. Object with ID '18012345678901234' does not exist", type: "IGApiException", code: 100, error_subcode: 33 } } };

    expect(await standIn({ one: gone }).instagram.media("token-sam", REEL.id)).toBe("not_found");
    expect(await standIn({ one: { status: 404 } }).instagram.media("token-sam", REEL.id)).toBe("not_found");
    expect(await standIn({ one: lost }).instagram.media("token-sam", REEL.id)).toBe("no_access");
    expect(standIn({ one: { status: 503 } }).instagram.media("token-sam", REEL.id)).rejects.toThrow("Instagram");
  });

  test("an id that is not one of Instagram's is never sent anywhere", async () => {
    const { instagram, calls } = standIn();

    expect(await instagram.media("token-sam", "../me?fields=id")).toBe("not_found");
    expect(calls).toEqual([]);
  });

  test("IG-BR-12 nothing of the caption, the video's address or the token is logged or thrown", async () => {
    const { instagram, logged } = standIn();
    await instagram.media("token-sam", REEL.id);
    await instagram.findMedia("token-sam", "DAbC1dEfGhI", 100);

    for (const secret of ["token-sam", "Glow Serum", "secret-signature", "cdninstagram"]) expect(JSON.stringify(logged)).not.toContain(secret);
  });
});
