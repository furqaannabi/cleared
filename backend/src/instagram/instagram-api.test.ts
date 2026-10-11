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

/** An Instagram that answers each kind of call as the test says, and remembers what it was sent. */
function standIn(answers: { code?: Answer; long?: Answer; me?: Answer; renew?: Answer } = {}) {
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
