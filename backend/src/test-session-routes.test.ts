/**
 * A session for end-to-end tests (account and history spec AH-FR-25 to AH-FR-29, AH-BR-09;
 * docs/decisions/2026-10-12-a-test-session-behind-a-secret.md). It is a way in without Google, so most
 * of what is proven here is what it refuses: no route without the secret, a wrong secret answered as
 * if there were no route, and never anyone but the one test creator.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { prisma } from "./db";
import { resetDatabase } from "../test/held-post";

beforeEach(resetDatabase);

const APP = "https://app.sponing.test";
const SECRET = "s3cr3t-for-tests-only-0123456789-abcdefghij";

function setUp(options: { secret?: string; limit?: number } = {}) {
  let now = new Date("2026-10-12T09:00:00Z");
  const logged: unknown[] = [];
  const app = createApp({
    prisma,
    appOrigin: APP,
    now: () => now,
    testSession: "secret" in options ? (options.secret === undefined ? undefined : { secret: options.secret, perHour: options.limit }) : { secret: SECRET, perHour: options.limit },
    log: (...parts) => void logged.push(parts),
  });
  /** A request as a test runner makes it: no origin, and whatever headers it is given. */
  const ask = (headers: Record<string, string> = {}, init: { method?: string; path?: string; body?: unknown } = {}) =>
    app.request(init.path ?? "/test/session", {
      method: init.method ?? "POST",
      headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  const cookieOf = (response: Response) => response.headers.getSetCookie().find((cookie) => cookie.startsWith("sponing_session="));
  const answer = async (response: Response) => ({ status: response.status, body: await response.text(), cookie: cookieOf(response) });
  return { app, ask, logged, answer, cookieOf, later: (minutes: number) => void (now = new Date(now.getTime() + minutes * 60_000)) };
}
const right = { "x-test-secret": SECRET };

describe("AH-FR-25 off unless a secret is set", () => {
  test("with no secret there is no route: it answers exactly as a path that does not exist, with or without the app's origin", async () => {
    const world = setUp({ secret: undefined });

    const cases: Record<string, string>[] = [{}, { origin: APP }, { ...right }, { ...right, origin: APP }];
    for (const headers of cases) {
      expect(await world.answer(await world.ask(headers))).toEqual(await world.answer(await world.ask(headers, { path: "/no/such-path" })));
    }
    expect(await prisma.creator.count()).toBe(0);
  });

  test.each([
    ["31 characters", "x".repeat(31)],
    ["an empty one", ""],
  ])("a secret of %s is too short to count: there is still no route, even for someone who knows it", async (_what, secret) => {
    const world = setUp({ secret });

    const response = await world.ask({ "x-test-secret": secret, origin: APP });

    expect(await world.answer(response)).toEqual(await world.answer(await world.ask({ origin: APP }, { path: "/no/such-path" })));
    expect(await prisma.creator.count()).toBe(0);
  });
});

describe("AH-FR-26 the secret is the way in", () => {
  test("with the secret in the header, a test runner with no origin is signed in: the cookie a sign-in sets, and the profile", async () => {
    const world = setUp();

    const response = await world.ask(right);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "Test Creator", welcomed: false, accounts: [] });
    const cookie = world.cookieOf(response)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await world.app.request("/me", { headers: { cookie: cookie.split(";")[0]! } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ name: "Test Creator" });
  });

  test.each([
    ["no secret sent", {}],
    ["a wrong secret", { "x-test-secret": `${SECRET}x` }],
    ["a secret that is the start of the right one", { "x-test-secret": SECRET.slice(0, 40) }],
    ["an empty secret", { "x-test-secret": "" }],
    ["the secret in another header", { authorization: `Bearer ${SECRET}` }],
  ])("%s is answered exactly as a path that does not exist, and nobody is signed in", async (_what, headers) => {
    const world = setUp();

    const origins: Record<string, string>[] = [{}, { origin: APP }, { origin: "https://evil.example" }];
    for (const origin of origins) {
      const given = await world.answer(await world.ask({ ...(headers as Record<string, string>), ...origin }));
      expect(given).toEqual(await world.answer(await world.ask(origin, { path: "/no/such-path" })));
      expect(given.cookie).toBeUndefined();
    }
    expect(await prisma.creator.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  test("the secret in the address or the body is not a secret sent: only the header counts", async () => {
    const world = setUp();

    const inAddress = await world.ask({ origin: APP }, { path: `/test/session?secret=${SECRET}&x-test-secret=${SECRET}` });
    const inBody = await world.ask({ origin: APP }, { body: { secret: SECRET, "x-test-secret": SECRET } });

    expect(inAddress.status).toBe(404);
    expect(inBody.status).toBe(404);
    expect(await prisma.session.count()).toBe(0);
  });

  test("only a POST: any other method with the right secret is as a path that does not exist", async () => {
    const world = setUp();

    for (const method of ["GET", "PUT", "DELETE"]) {
      expect(await world.answer(await world.ask({ ...right, origin: APP }, { method }))).toEqual(await world.answer(await world.ask({ origin: APP }, { method, path: "/no/such-path" })));
    }
    expect(await prisma.session.count()).toBe(0);
  });

  test("AH-BR-09 a denial is logged without what was sent, and the secret is in no log and no answer", async () => {
    const world = setUp();

    const refused = await world.ask({ "x-test-secret": "a-guess-at-the-secret-000000000000000" });
    const given = await world.ask(right);

    const logged = JSON.stringify(world.logged);
    expect(logged).toContain("refused");
    expect(logged).not.toContain("a-guess-at-the-secret");
    expect(logged).not.toContain(SECRET);
    expect(`${await refused.text()}${await given.text()}${JSON.stringify([...given.headers])}`).not.toContain(SECRET);
  });
});

describe("AH-FR-27, AH-FR-28 one fixed test creator, and nobody else", () => {
  test("asked again, it is the same creator, with another session", async () => {
    const world = setUp();

    await world.ask(right);
    await world.ask(right);

    expect(await prisma.creator.count()).toBe(1);
    expect(await prisma.session.count()).toBe(2);
  });

  test("it takes no name, email or id: whatever is sent, the session is the test creator's and never a real account's", async () => {
    const world = setUp();
    const sam = await prisma.creator.create({ data: { googleId: "108234567890123456789", name: "Sam Rivera", email: "sam@example.com", paypalEmail: "sam.pay@example.com", createdAt: new Date() } });

    const response = await world.ask(right, { path: `/test/session?creatorId=${sam.id}&email=sam@example.com`, body: { creatorId: sam.id, googleId: sam.googleId, email: "sam@example.com", name: "Sam Rivera" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "Test Creator", welcomed: false, accounts: [] });
    expect(await prisma.session.count({ where: { creatorId: sam.id } })).toBe(0);
    expect(await prisma.creator.findUnique({ where: { id: sam.id } })).toMatchObject({ name: "Sam Rivera", email: "sam@example.com", paypalEmail: "sam.pay@example.com" });
  });

  test("the test creator is an ordinary creator: nothing is connected for it, and it starts a deal as anyone does", async () => {
    const world = setUp();
    const cookie = world.cookieOf(await world.ask(right))!.split(";")[0]!;

    const started = await world.app.request("/deals", { method: "POST", headers: { cookie, origin: APP, "content-type": "application/json" }, body: JSON.stringify({ brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }] }) });

    expect(started.status).toBe(200);
    expect(await prisma.connectedAccount.count()).toBe(0);
    // Its own changing requests are held to the app's origin, like anyone's.
    expect((await world.app.request("/deals", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).status).toBe(403);
  });
});

describe("AH-FR-29 a limit", () => {
  test("over the hourly limit the answer is 429 and no session is made; an hour on, it works again", async () => {
    const world = setUp({ limit: 3 });
    for (let made = 0; made < 3; made++) expect((await world.ask(right)).status).toBe(200);

    const over = await world.ask(right);

    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: { code: "test_session_limit", resetsAt: "2026-10-12T10:00:00.000Z" } });
    expect(world.cookieOf(over)).toBeUndefined();
    expect(await prisma.session.count()).toBe(3);

    world.later(61);
    expect((await world.ask(right)).status).toBe(200);
  });

  test("a wrong secret never counts towards the limit, and is never told there is one", async () => {
    const world = setUp({ limit: 1 });
    for (let guess = 0; guess < 5; guess++) expect((await world.ask({ "x-test-secret": "wrong", origin: APP })).status).toBe(404);

    expect((await world.ask(right)).status).toBe(200);
    expect((await world.ask({ "x-test-secret": "wrong", origin: APP })).status).toBe(404);
  });

  test("left alone, the limit is 120 an hour", async () => {
    const world = setUp();
    for (let made = 0; made < 120; made++) expect((await world.ask(right)).status).toBe(200);

    expect((await world.ask(right)).status).toBe(429);
  });
});
