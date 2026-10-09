/**
 * Signing in with Google and connecting YouTube, through the app, with Google replaced by the fake
 * (deal set-up spec DS-FR-01 to DS-FR-04, DS-FR-11, DS-FR-12).
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor } from "../test/browser";
import { FakeGoogle, type Person } from "../test/fake-google";
import { createApp } from "./app";
import { prisma } from "./db";
import { localSecrets } from "./secrets/secrets";

const APP = "https://app.cleared.test";
const API = "https://api.cleared.test";
const at = (iso: string) => new Date(iso);
const secrets = localSecrets(Buffer.alloc(32, 7).toString("base64"));

const sam: Person = { googleId: "google-sam", name: "Sam Rivera", email: "sam@example.com", channel: { id: "UC-sam", name: "Sam Makes" } };

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

function setUp(options: { google?: FakeGoogle | null } = {}) {
  const google = options.google === null ? undefined : (options.google ?? new FakeGoogle());
  let now = at("2026-10-09T09:00:00Z");
  const app = createApp({ prisma, appOrigin: APP, apiOrigin: API, now: () => now, google, secrets });
  const browser = browserFor(app, APP);
  return {
    google: google as FakeGoogle,
    browser,
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

type World = ReturnType<typeof setUp>;

/** Starts a trip to Google and reads where the browser was sent. */
async function startAt(world: World, path: string) {
  const response = await world.browser.visit(path);
  const location = response.headers.get("location") ?? "";
  return { response, location, state: URL.canParse(location) ? (new URL(location).searchParams.get("state") ?? "") : "" };
}

/** Signs in through Google as `person`: there, approve, and back. */
async function signIn(world: World, person: Person = sam, query = "") {
  const { state } = await startAt(world, `/auth/google${query}`);
  return world.browser.visit(`/auth/google/callback?code=${world.google.approve(state, person)}&state=${state}`);
}

const me = async (world: World) => (await world.browser.send("GET", "/me")).json();

describe("DS-FR-01 sign in with Google", () => {
  test("the browser is sent to Google, asked for identity only, with a callback on the API", async () => {
    const world = setUp();

    const { response, location } = await startAt(world, "/auth/google");

    expect(response.status).toBe(302);
    expect(location).toStartWith("https://accounts.google.test/auth");
    expect(world.google.started).toMatchObject([{ scope: "identity", redirectUri: `${API}/auth/google/callback` }]);
    expect(world.google.started[0]!.state.length).toBeGreaterThanOrEqual(32);
    expect(world.google.started[0]!.codeChallenge.length).toBeGreaterThanOrEqual(43);
  });

  test("coming back approved signs the browser in", async () => {
    const world = setUp();

    const response = await signIn(world);

    expect(response.status).toBe(303);
    expect(await me(world)).toEqual({ name: "Sam Rivera", email: "sam@example.com", demo: false, welcomed: false, accounts: [] });
  });

  test("what is kept in the browser while it is at Google cannot be read by the page, and goes when it is back", async () => {
    const world = setUp();
    const { response, state } = await startAt(world, "/auth/google");
    const pending = response.headers.getSetCookie().find((cookie) => cookie.startsWith("cleared_pending="))!;

    expect(pending).toContain("HttpOnly");
    expect(pending).toContain("Secure");
    expect(pending).toContain("SameSite=Lax");

    await world.browser.visit(`/auth/google/callback?code=${world.google.approve(state, sam)}&state=${state}`);
    expect(world.browser.cookies.has("cleared_pending")).toBe(false);
  });

  test.each([
    ["an answer that does not match the request that started it", (state: string) => `state=${state}x`],
    ["an answer with no state", () => ""],
  ])("%s signs nobody in", async (_, stateQuery) => {
    const world = setUp();
    const { state } = await startAt(world, "/auth/google");
    const code = world.google.approve(state, sam);

    const response = await world.browser.visit(`/auth/google/callback?code=${code}&${stateQuery(state)}`);

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect(await prisma.creator.count()).toBe(0);
    expect((await world.browser.send("GET", "/me")).status).toBe(401);
  });

  test("an answer opened in a browser that never started a sign-in signs nobody in", async () => {
    const world = setUp();
    const { state } = await startAt(world, "/auth/google");
    const code = world.google.approve(state, sam);
    const stranger = browserFor(createApp({ prisma, appOrigin: APP, apiOrigin: API, google: world.google, secrets }), APP);

    const response = await stranger.visit(`/auth/google/callback?code=${code}&state=${state}`);

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect(stranger.cookies.has("cleared_session")).toBe(false);
  });

  test("the same answer used a second time signs nobody in", async () => {
    const world = setUp();
    const { state } = await startAt(world, "/auth/google");
    const callback = `/auth/google/callback?code=${world.google.approve(state, sam)}&state=${state}`;
    await world.browser.visit(callback);
    await world.browser.send("POST", "/auth/sign-out");

    const again = await world.browser.visit(callback);

    expect(again.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect((await world.browser.send("GET", "/me")).status).toBe(401);
  });

  test("declining at Google sends the visitor back to the sign-in page, saying so", async () => {
    const world = setUp();
    const { state } = await startAt(world, "/auth/google");

    const response = await world.browser.visit(`/auth/google/callback?error=access_denied&state=${state}`);

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=cancelled`);
    expect(await prisma.creator.count()).toBe(0);
  });

  test("a code Google refuses, or an identity that cannot be verified, signs nobody in", async () => {
    const world = setUp();
    const { state } = await startAt(world, "/auth/google");
    const code = world.google.approve(state, sam);
    world.google.refuseNextExchange();

    const response = await world.browser.visit(`/auth/google/callback?code=${code}&state=${state}`);

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect(await prisma.creator.count()).toBe(0);
  });

  test("a Google account whose email is not verified signs nobody in", async () => {
    const world = setUp();

    const response = await signIn(world, { ...sam, emailVerified: false });

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect(await prisma.creator.count()).toBe(0);
  });

  test("when Google sign-in is not set up, the visitor is told on the sign-in page", async () => {
    const world = setUp({ google: null });

    const response = await world.browser.visit("/auth/google");

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?problem=not_configured`);
  });
});

describe("DS-FR-04 where a sign-in lands", () => {
  test("a first sign-in lands on the welcome page, whatever page they were going to", async () => {
    const world = setUp();

    const response = await signIn(world, sam, "?next=%2Fdeals%2Fabc");

    expect(response.headers.get("location")).toBe(`${APP}/welcome`);
  });

  test("a later one lands on the page they were going to, or on their deals", async () => {
    const world = setUp();
    await signIn(world);
    await world.browser.send("POST", "/me/welcomed");
    await world.browser.send("POST", "/auth/sign-out");

    expect((await signIn(world, sam, "?next=%2Fdeals%2Fabc")).headers.get("location")).toBe(`${APP}/deals/abc`);
    await world.browser.send("POST", "/auth/sign-out");
    expect((await signIn(world)).headers.get("location")).toBe(`${APP}/deals`);
  });

  test("an address on another site is dropped", async () => {
    const world = setUp();
    await signIn(world);
    await world.browser.send("POST", "/me/welcomed");
    await world.browser.send("POST", "/auth/sign-out");

    const response = await signIn(world, sam, `?next=${encodeURIComponent("https://evil.example/deals")}`);

    expect(response.headers.get("location")).toBe(`${APP}/deals`);
  });
});

/** Connects YouTube as `person`: to Google, approve, and back. The browser must already be signed in. */
async function connectYouTube(world: World, person: Person = sam, query = "") {
  const { state } = await startAt(world, `/connect/youtube${query}`);
  return world.browser.visit(`/connect/youtube/callback?code=${world.google.approve(state, person)}&state=${state}`);
}

describe("DS-FR-11 connect YouTube", () => {
  test("the browser is sent to Google and asked for read-only YouTube access, with a callback on the API", async () => {
    const world = setUp();
    await signIn(world);

    const { response } = await startAt(world, "/connect/youtube");

    expect(response.status).toBe(302);
    expect(world.google.started.at(-1)).toMatchObject({ scope: "youtube", redirectUri: `${API}/connect/youtube/callback` });
  });

  test("coming back approved stores the channel, and the creator's profile shows it", async () => {
    const world = setUp();
    await signIn(world);

    const response = await connectYouTube(world, sam, "?next=%2Fdeals%2Fabc%2Finvite");

    expect(response.headers.get("location")).toBe(`${APP}/deals/abc/invite?connected=youtube`);
    expect(await me(world)).toMatchObject({ accounts: [{ platform: "youtube", name: "Sam Makes" }] });
    expect(await prisma.connectedAccount.findMany()).toMatchObject([
      { platform: "youtube", externalId: "UC-sam", name: "Sam Makes", synthetic: false },
    ]);
  });

  test("Google's refresh token is stored encrypted, and is in nothing the page is sent (DS-BR-14)", async () => {
    const world = setUp();
    await signIn(world);
    await connectYouTube(world);

    const [account] = await prisma.connectedAccount.findMany();
    const token = await secrets.decrypt(account!.refreshTokenEncrypted!);

    expect(token).toStartWith("refresh-");
    expect(account!.refreshTokenEncrypted).not.toContain(token);
    expect(JSON.stringify(await me(world))).not.toContain(token);
  });

  test("the channel may be on a different Google account from the one they sign in with", async () => {
    const world = setUp();
    await signIn(world);

    await connectYouTube(world, { googleId: "google-brand", name: "Sam's Channel", email: "channel@example.com", channel: { id: "UC-other", name: "The Other Channel" } });

    expect(await me(world)).toMatchObject({ name: "Sam Rivera", accounts: [{ platform: "youtube", name: "The Other Channel" }] });
    expect(await prisma.creator.count()).toBe(1);
  });

  test("connecting again replaces the channel, including a demo account's made-up one", async () => {
    const world = setUp();
    await world.browser.send("POST", "/auth/demo", { form: true });

    await connectYouTube(world);

    expect(await prisma.connectedAccount.findMany()).toMatchObject([{ externalId: "UC-sam", synthetic: false }]);
  });

  test("nobody signed in is sent to sign in, and nothing is asked of Google", async () => {
    const world = setUp();

    const { response } = await startAt(world, "/connect/youtube?next=%2Fdeals%2Fabc%2Finvite");

    expect(response.headers.get("location")).toBe(`${APP}/sign-in?next=%2Fdeals%2Fabc%2Finvite`);
    expect(world.google.started).toHaveLength(0);
  });

  test("an answer that comes back to a browser signed in as someone else connects nothing", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world, "/connect/youtube");
    const code = world.google.approve(state, sam);
    // Another creator signs in on the same browser before Google's answer arrives.
    await world.browser.send("POST", "/auth/sign-out");
    await signIn(world, { googleId: "google-mo", name: "Mo", email: "mo@example.com" });

    await world.browser.visit(`/connect/youtube/callback?code=${code}&state=${state}`);

    expect(await prisma.connectedAccount.count()).toBe(0);
  });
});

describe("DS-FR-12 not connected", () => {
  test.each<[string, Partial<Person>, string]>([
    ["has no YouTube channel", { channel: null }, "no_channel"],
    ["unticks YouTube access on Google's screen", { grantsYoutube: false }, "declined"],
  ])("a Google account that %s stores nothing, and the page is told which", async (_, change, reason) => {
    const world = setUp();
    await signIn(world);

    const response = await connectYouTube(world, { ...sam, ...change }, "?next=%2Fwelcome");

    expect(response.headers.get("location")).toBe(`${APP}/welcome?connect=${reason}`);
    expect(await prisma.connectedAccount.count()).toBe(0);
  });

  test("pressing cancel at Google stores nothing", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world, "/connect/youtube");

    const response = await world.browser.visit(`/connect/youtube/callback?error=access_denied&state=${state}`);

    expect(response.headers.get("location")).toBe(`${APP}/deals?connect=declined`);
    expect(await prisma.connectedAccount.count()).toBe(0);
  });

  test("an answer that does not match, or that Google refuses, stores nothing", async () => {
    const world = setUp();
    await signIn(world);
    const first = await startAt(world, "/connect/youtube");
    const mismatched = await world.browser.visit(`/connect/youtube/callback?code=${world.google.approve(first.state, sam)}&state=wrong`);
    expect(mismatched.headers.get("location")).toBe(`${APP}/deals?connect=failed`);

    const second = await startAt(world, "/connect/youtube");
    const code = world.google.approve(second.state, sam);
    world.google.refuseNextExchange();
    const refused = await world.browser.visit(`/connect/youtube/callback?code=${code}&state=${second.state}`);
    expect(refused.headers.get("location")).toBe(`${APP}/deals?connect=failed`);

    expect(await prisma.connectedAccount.count()).toBe(0);
  });

  test("a sign-in answer cannot be used to connect, and a connect answer cannot be used to sign in", async () => {
    const world = setUp();
    await signIn(world);
    const signingIn = await startAt(world, "/auth/google");
    const asConnect = await world.browser.visit(`/connect/youtube/callback?code=${world.google.approve(signingIn.state, sam)}&state=${signingIn.state}`);
    expect(asConnect.headers.get("location")).toBe(`${APP}/deals?connect=failed`);

    const connecting = await startAt(world, "/connect/youtube");
    const asSignIn = await world.browser.visit(`/auth/google/callback?code=${world.google.approve(connecting.state, sam)}&state=${connecting.state}`);
    expect(asSignIn.headers.get("location")).toBe(`${APP}/sign-in?problem=google`);
    expect(await prisma.connectedAccount.count()).toBe(0);
  });
});
