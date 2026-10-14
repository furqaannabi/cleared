/**
 * Connecting an Instagram account, through the app, with Instagram replaced by the fake (Instagram
 * Reels spec IG-FR-02 to IG-FR-06, IG-BR-01, IG-BR-02, IG-BR-10).
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor } from "../test/browser";
import { FakeGoogle, type Person } from "../test/fake-google";
import { FakeInstagram, type InstagramPerson } from "../test/fake-instagram";
import { createApp } from "./app";
import { prisma } from "./db";
import { createInstagramConnections } from "./instagram/connections";
import { runDueJobs } from "./jobs/jobs";
import { localSecrets } from "./secrets/secrets";

const APP = "https://app.sponing.test";
const API = "https://api.sponing.test";
const at = (iso: string) => new Date(iso);
const secrets = localSecrets(Buffer.alloc(32, 7).toString("base64"));

const sam: Person = { googleId: "google-sam", name: "Sam Rivera", email: "sam@example.com", channel: { id: "UC-sam", name: "Sam Makes" } };
const ada: Person = { googleId: "google-ada", name: "Ada Okafor", email: "ada@example.com", channel: null };
const samOnInstagram: InstagramPerson = { id: "17841400000000001", username: "sam.rivera" };

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

function setUp(options: { instagram?: null } = {}) {
  let now = at("2026-10-11T09:00:00Z");
  const clock = () => now;
  const google = new FakeGoogle();
  const instagram = new FakeInstagram(clock);
  const connections = createInstagramConnections({ prisma, now: clock, instagram, secrets });
  const app = createApp({ prisma, appOrigin: APP, apiOrigin: API, now: clock, google, secrets, instagram: options.instagram === null ? undefined : instagram, instagramConnections: connections });
  return {
    google,
    instagram,
    connections,
    app,
    browser: browserFor(app, APP),
    now: clock,
    timeIs: (iso: string) => {
      now = at(iso);
    },
    runJobs: () => runDueJobs(prisma, connections.handlers, { now, log: () => {} }),
  };
}

type World = ReturnType<typeof setUp>;
type Browser = World["browser"];

async function startAt(browser: Browser, path: string) {
  const response = await browser.visit(path);
  const location = response.headers.get("location") ?? "";
  return { response, location, state: URL.canParse(location) ? (new URL(location).searchParams.get("state") ?? "") : "" };
}

async function signIn(world: World, person: Person = sam, browser: Browser = world.browser) {
  const { state } = await startAt(browser, "/auth/google");
  return browser.visit(`/auth/google/callback?code=${world.google.approve(state, person)}&state=${state}`);
}

async function connect(world: World, person: InstagramPerson = samOnInstagram, query = "", browser: Browser = world.browser) {
  const { state } = await startAt(browser, `/connect/instagram${query}`);
  return browser.visit(`/connect/instagram/callback?code=${world.instagram.approve(state, person)}&state=${state}`);
}

const me = async (world: World) => (await world.browser.send("GET", "/me")).json();
const stored = () => prisma.connectedAccount.findMany({ where: { platform: "instagram" } });
const tokenOf = async () => secrets.decrypt((await stored())[0]!.refreshTokenEncrypted!);

describe("IG-FR-02 connect Instagram", () => {
  test("the browser is sent to Instagram's own sign-in, with a callback on the API", async () => {
    const world = setUp();
    await signIn(world);

    const { response, location } = await startAt(world.browser, "/connect/instagram");

    expect(response.status).toBe(302);
    expect(new URL(location).hostname).toBe("www.instagram.test");
    expect(world.instagram.started).toEqual([{ state: expect.any(String), redirectUri: `${API}/connect/instagram/callback` }]);
    expect(world.instagram.started[0]!.state.length).toBeGreaterThan(30);
  });

  test("nobody signed in is sent to sign in, and nothing is asked of Instagram", async () => {
    const world = setUp();

    const { location } = await startAt(world.browser, "/connect/instagram?next=%2Fdeals%2Fabc%2Finvite");

    expect(location).toBe(`${APP}/sign-in?next=%2Fdeals%2Fabc%2Finvite`);
    expect(world.instagram.started).toEqual([]);
  });

  test("when Instagram is not set up, the creator is sent back and told it did not work", async () => {
    const world = setUp({ instagram: null });
    await signIn(world);

    expect((await startAt(world.browser, "/connect/instagram")).location).toBe(`${APP}/deals?connect=failed`);
  });
});

describe("IG-FR-03, IG-FR-04 coming back approved", () => {
  test("the account is stored, and the creator's profile lists it beside YouTube", async () => {
    const world = setUp();
    await signIn(world);

    const response = await connect(world, samOnInstagram, "?next=%2Fdeals%2Fabc%2Finvite");

    expect(response.headers.get("location")).toBe(`${APP}/deals/abc/invite?connected=instagram`);
    expect(await stored()).toMatchObject([{ platform: "instagram", externalId: "17841400000000001", name: "sam.rivera", tokenExpiresAt: at("2026-12-10T09:00:00Z") }]);
    expect(((await me(world)) as { accounts: unknown[] }).accounts).toEqual([{ platform: "instagram", name: "sam.rivera", inUse: false }]);
  });

  test("IG-BR-02 the token is stored encrypted, and is in nothing the page is sent", async () => {
    const world = setUp();
    await signIn(world);
    const response = await connect(world);

    const [account] = await stored();
    const token = await tokenOf();

    expect(token).toStartWith("ig-token-");
    expect(account!.refreshTokenEncrypted).not.toContain(token);
    expect(JSON.stringify(await me(world))).not.toContain(token);
    expect(response.headers.get("location")).not.toContain(token);
  });

  test("connecting again replaces the account", async () => {
    const world = setUp();
    await signIn(world);
    await connect(world);

    await connect(world, { id: "17841400000000002", username: "sam.second" });

    expect(await stored()).toMatchObject([{ externalId: "17841400000000002", name: "sam.second" }]);
  });

  test("a YouTube connection is left as it is", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/youtube");
    await world.browser.visit(`/connect/youtube/callback?code=${world.google.approve(state, sam)}&state=${state}`);

    await connect(world);

    expect(((await me(world)) as { accounts: { platform: string }[] }).accounts.map((account) => account.platform).sort()).toEqual(["instagram", "youtube"]);
  });
});

describe("IG-FR-05 not connected", () => {
  test("an account that is not a professional one is refused with that reason, and nothing is stored", async () => {
    const world = setUp();
    await signIn(world);

    const response = await connect(world, { ...samOnInstagram, professional: false });

    expect(response.headers.get("location")).toBe(`${APP}/deals?connect=not_professional`);
    expect(await stored()).toEqual([]);
  });

  test("declining at Instagram stores nothing", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/instagram");

    const response = await world.browser.visit(`/connect/instagram/callback?error=access_denied&error_reason=user_denied&state=${state}`);

    expect(response.headers.get("location")).toBe(`${APP}/deals?connect=declined`);
    expect(await stored()).toEqual([]);
  });

  test("a code Instagram refuses, or Instagram failing, stores nothing", async () => {
    const world = setUp();
    await signIn(world);
    const first = await startAt(world.browser, "/connect/instagram");
    expect((await world.browser.visit(`/connect/instagram/callback?code=made-up&state=${first.state}`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);

    const second = await startAt(world.browser, "/connect/instagram");
    const code = world.instagram.approve(second.state, samOnInstagram);
    world.instagram.down = true;
    expect((await world.browser.visit(`/connect/instagram/callback?code=${code}&state=${second.state}`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);
    expect(await stored()).toEqual([]);
  });
});

describe("IG-BR-10 a connection belongs to the browser and the creator that started it", () => {
  test("an answer that does not carry the value this browser started with connects nothing", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/instagram");
    const code = world.instagram.approve(state, samOnInstagram);

    expect((await world.browser.visit(`/connect/instagram/callback?code=${code}&state=someone-elses`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);
    expect(await stored()).toEqual([]);
  });

  test("the same answer used a second time connects nothing more", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/instagram");
    const code = world.instagram.approve(state, samOnInstagram);
    await world.browser.visit(`/connect/instagram/callback?code=${code}&state=${state}`);
    await prisma.connectedAccount.deleteMany();

    expect((await world.browser.visit(`/connect/instagram/callback?code=${code}&state=${state}`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);
    expect(await stored()).toEqual([]);
  });

  test("an answer opened in a browser signed in as someone else connects nothing", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/instagram");
    const code = world.instagram.approve(state, samOnInstagram);
    // Someone else signs in on the same browser before the answer comes back.
    await signIn(world, ada);

    expect((await world.browser.visit(`/connect/instagram/callback?code=${code}&state=${state}`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);
    expect(await stored()).toEqual([]);
  });

  test("a YouTube answer cannot be used to connect Instagram", async () => {
    const world = setUp();
    await signIn(world);
    const { state } = await startAt(world.browser, "/connect/youtube");

    expect((await world.browser.visit(`/connect/instagram/callback?code=anything&state=${state}`)).headers.get("location")).toBe(`${APP}/deals?connect=failed`);
    expect(await stored()).toEqual([]);
  });
});

describe("IG-FR-06 a token is kept alive", () => {
  /** A connected account, with the daily renewal scheduled as the service does at start-up. */
  async function connected(world: World) {
    await signIn(world);
    await connect(world);
    await world.connections.scheduleRenewals();
    return tokenOf();
  }

  test("a token more than 7 days old is renewed: the new one is stored encrypted, with its new end", async () => {
    const world = setUp();
    const first = await connected(world);
    world.timeIs("2026-10-19T09:00:00Z");

    await world.runJobs();

    expect(world.instagram.renewals).toEqual([first]);
    expect(await tokenOf()).not.toBe(first);
    expect((await stored())[0]!.tokenExpiresAt).toEqual(at("2026-12-18T09:00:00Z"));
  });

  test("a token 7 days old or less is left alone, and the job comes back the next day", async () => {
    const world = setUp();
    const first = await connected(world);
    world.timeIs("2026-10-18T09:00:00Z");

    await world.runJobs();

    expect(world.instagram.renewals).toEqual([]);
    expect(await tokenOf()).toBe(first);
    expect(await prisma.job.findMany({ where: { name: "instagram_renew", status: "pending" } })).toMatchObject([{ runAt: at("2026-10-19T09:00:00Z") }]);
  });

  test("a token that cannot be renewed is lost access: it is removed, so the creator is asked to reconnect", async () => {
    const world = setUp();
    world.instagram.lost.add(await connected(world));
    world.timeIs("2026-10-19T09:00:00Z");

    await world.runJobs();

    expect(await stored()).toMatchObject([{ externalId: "17841400000000001", refreshTokenEncrypted: null, tokenExpiresAt: null }]);
  });

  test("when Instagram fails the token is kept as it is, and tried again the next day", async () => {
    const world = setUp();
    const first = await connected(world);
    world.instagram.down = true;
    world.timeIs("2026-10-19T09:00:00Z");

    await world.runJobs();

    expect(await tokenOf()).toBe(first);
    expect(await prisma.job.count({ where: { name: "instagram_renew", status: "pending" } })).toBe(1);
  });

  test("scheduling the renewal twice leaves one job", async () => {
    const world = setUp();
    await world.connections.scheduleRenewals();
    await world.connections.scheduleRenewals();

    expect(await prisma.job.count({ where: { name: "instagram_renew" } })).toBe(1);
  });
});
