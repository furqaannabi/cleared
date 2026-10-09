/**
 * The real Google port, with Google replaced by a stand-in `fetch` (deal set-up spec DS-FR-01, DS-FR-11).
 * Identity tokens here are signed with a key made for the test, which the stand-in publishes the way
 * Google publishes its own.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { createGoogle } from "./google";

const CLIENT_ID = "client-id.apps.googleusercontent.com";
const REDIRECT = "https://api.cleared.test/auth/google/callback";
const NOW = new Date("2026-10-09T09:00:00Z");

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let published: JWK;

beforeAll(async () => {
  const ours = await generateKeyPair("RS256");
  signingKey = ours.privateKey;
  published = { ...(await exportJWK(ours.publicKey)), kid: "key-1", alg: "RS256", use: "sig" };
  otherKey = (await generateKeyPair("RS256")).privateKey;
});

/** An identity token as Google would issue it, unless `change` says otherwise. */
function identityToken(change: { claims?: Record<string, unknown>; key?: CryptoKey; expiresAt?: Date } = {}) {
  return new SignJWT({
    sub: "google-sam",
    name: "Sam Rivera",
    email: "sam@example.com",
    email_verified: true,
    nonce: "nonce-1",
    ...change.claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "key-1" })
    .setIssuer((change.claims?.iss as string) ?? "https://accounts.google.com")
    .setAudience((change.claims?.aud as string) ?? CLIENT_ID)
    .setIssuedAt(Math.floor(NOW.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor((change.expiresAt ?? new Date(NOW.getTime() + 3600_000)).getTime() / 1000))
    .sign(change.key ?? signingKey);
}

interface Sent {
  method: string;
  url: URL;
  headers: Headers;
  body: URLSearchParams;
}

/** A Google that answers the token and channel calls with whatever the test says. */
function standIn(answers: { token?: () => Promise<{ status: number; json?: unknown }> | "network_error"; channels?: { status: number; json?: unknown } }) {
  const sent: Sent[] = [];
  const logged: unknown[] = [];
  const google = createGoogle({
    clientId: CLIENT_ID,
    clientSecret: "client-secret",
    now: () => NOW,
    log: (...parts) => logged.push(parts),
    fetch: async (input, init) => {
      const url = new URL(String(input));
      sent.push({ method: init?.method ?? "GET", url, headers: new Headers(init?.headers), body: new URLSearchParams(String(init?.body ?? "")) });
      if (url.pathname.endsWith("/certs")) return Response.json({ keys: [published] });
      if (url.hostname === "oauth2.googleapis.com") {
        const answer = answers.token?.();
        if (!answer || answer === "network_error") throw new TypeError("fetch failed");
        const { status, json } = await answer;
        return new Response(JSON.stringify(json ?? {}), { status });
      }
      const { status, json } = answers.channels ?? { status: 404 };
      return new Response(JSON.stringify(json ?? {}), { status });
    },
  });
  return { google, sent, logged };
}

const exchange = (google: ReturnType<typeof createGoogle>) =>
  google.exchange({ code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1", redirectUri: REDIRECT });

const tokenAnswer = (idToken: Promise<string>, extra: Record<string, unknown> = {}) => async () => ({
  status: 200,
  json: { access_token: "access-1", id_token: await idToken, scope: "openid email profile", expires_in: 3599, ...extra },
});

describe("DS-FR-01 the address the browser is sent to", () => {
  const start = (scope: "identity" | "youtube") =>
    new URL(standIn({}).google.signInUrl({ scope, state: "state-1", nonce: "nonce-1", codeChallenge: "challenge-1", redirectUri: REDIRECT }));

  test("signing in asks Google for identity only", () => {
    const url = start("identity");

    expect(url.origin).toBe("https://accounts.google.com");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: "openid email profile",
      state: "state-1",
      nonce: "nonce-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.has("access_type")).toBe(false);
    expect(url.toString()).not.toContain("client-secret");
  });

  test("connecting YouTube adds read-only YouTube access, kept after the creator leaves (DS-FR-11)", () => {
    const url = start("youtube");

    expect(url.searchParams.get("scope")).toBe("openid email profile https://www.googleapis.com/auth/youtube.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });
});

describe("DS-FR-01 exchanging Google's code", () => {
  test("the code is exchanged with the proof key and the secret, and the verified identity comes back", async () => {
    const { google, sent } = standIn({ token: tokenAnswer(identityToken()) });

    expect(await exchange(google)).toEqual({
      ok: true,
      identity: { googleId: "google-sam", name: "Sam Rivera", email: "sam@example.com", emailVerified: true },
      accessToken: "access-1",
      refreshToken: undefined,
      youtube: false,
    });
    const token = sent.find((request) => request.url.hostname === "oauth2.googleapis.com")!;
    expect(token.method).toBe("POST");
    expect(Object.fromEntries(token.body)).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      code_verifier: "verifier-1",
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      client_secret: "client-secret",
    });
    // The secret travels in the body only, never in an address.
    expect(token.url.toString()).not.toContain("client-secret");
  });

  test("read-only YouTube access and a refresh token are reported when Google grants them", async () => {
    const { google } = standIn({
      token: tokenAnswer(identityToken(), {
        refresh_token: "refresh-1",
        scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
      }),
    });

    expect(await exchange(google)).toMatchObject({ ok: true, refreshToken: "refresh-1", youtube: true });
  });

  test.each<[string, () => Promise<string>]>([
    ["meant for another app", () => identityToken({ claims: { aud: "someone-else.apps.googleusercontent.com" } })],
    ["not issued by Google", () => identityToken({ claims: { iss: "https://accounts.evil.example" } })],
    ["expired", () => identityToken({ expiresAt: new Date(NOW.getTime() - 60_000) })],
    ["from a different sign-in", () => identityToken({ claims: { nonce: "another-nonce" } })],
    ["signed by a key Google does not publish", () => identityToken({ key: otherKey })],
    ["missing who the person is", () => identityToken({ claims: { sub: undefined } })],
  ])("an identity token that is %s is not accepted", async (_, token) => {
    const { google } = standIn({ token: tokenAnswer(token()) });

    expect(await exchange(google)).toEqual({ ok: false });
  });

  test("an email Google has not verified is reported as unverified", async () => {
    const { google } = standIn({ token: tokenAnswer(identityToken({ claims: { email_verified: false } })) });

    expect(await exchange(google)).toMatchObject({ ok: true, identity: { emailVerified: false } });
  });

  test.each<[string, () => Promise<{ status: number; json?: unknown }> | "network_error"]>([
    ["Google refuses the code", async () => ({ status: 400, json: { error: "invalid_grant" } })],
    ["Google's answer has no identity token", async () => ({ status: 200, json: { access_token: "access-1" } })],
    ["Google does not answer", () => "network_error"],
  ])("when %s, nothing is accepted", async (_, token) => {
    const { google } = standIn({ token });

    expect(await exchange(google)).toEqual({ ok: false });
  });

  test("a failure is logged without the code, the secret or any token (DS-BR-15)", async () => {
    const { google, logged } = standIn({ token: async () => ({ status: 400, json: { error: "invalid_grant", error_description: "code-1 was used" } }) });

    await exchange(google);

    expect(logged).toHaveLength(1);
    const text = JSON.stringify(logged);
    expect(text).not.toContain("client-secret");
    expect(text).not.toContain("code-1");
    expect(text).not.toContain("verifier-1");
  });
});

describe("DS-FR-11 reading the creator's channel", () => {
  test("the channel's id and name are read with the creator's access token", async () => {
    const { google, sent } = standIn({ channels: { status: 200, json: { items: [{ id: "UC-sam", snippet: { title: "Sam Makes" } }] } } });

    expect(await google.channel("access-1")).toEqual({ id: "UC-sam", name: "Sam Makes" });
    const request = sent.at(-1)!;
    expect(request.url.toString()).toBe("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true");
    expect(request.headers.get("authorization")).toBe("Bearer access-1");
  });

  test("a Google account with no channel has none (DS-FR-12)", async () => {
    expect(await standIn({ channels: { status: 200, json: { items: [] } } }).google.channel("access-1")).toBe("none");
    expect(await standIn({ channels: { status: 200, json: {} } }).google.channel("access-1")).toBe("none");
  });

  test.each([401, 403, 500])("a %i from YouTube is unavailable, not 'no channel'", async (status) => {
    expect(await standIn({ channels: { status } }).google.channel("access-1")).toBe("unavailable");
  });
});
