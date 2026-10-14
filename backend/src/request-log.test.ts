/**
 * The log of requests, and the handler for an error no route handled (deal set-up spec DS-FR-49 to
 * DS-FR-51, DS-BR-15). Most of what is proven here is what never reaches a log line: a real path, a
 * query string, a body, a token, or an error's message.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor } from "../test/browser";
import { resetDatabase } from "../test/held-post";
import { createApp } from "./app";
import { FakePayPal } from "../test/fake-paypal";
import { prisma } from "./db";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createSessions } from "./sessions/sessions";

beforeEach(resetDatabase);

const APP = "https://app.sponing.test";
type Line = { message: string; details: Record<string, unknown> };

function setUp() {
  const requests: Line[] = [];
  const errors: unknown[] = [];
  const app = createApp({
    prisma,
    appOrigin: APP,
    money: createMoney({ prisma, paypal: new FakePayPal(), posts: recordedPosts(prisma) }),
    requestLog: (message, details) => void requests.push({ message, details }),
    log: (...parts) => void errors.push(parts),
  });
  /** Everything that was logged anywhere, as one text to search. */
  const logged = () => JSON.stringify([requests, errors]);
  /** A browser signed in as a creator who has one deal with one post. */
  async function creator() {
    const { id } = await prisma.creator.create({ data: { googleId: "108234567890123456789", name: "Sam Rivera", email: "sam@example.com", createdAt: new Date() } });
    const browser = browserFor(app, APP);
    browser.cookies.set("sponing_session", await createSessions({ prisma, now: () => new Date() }).start(id));
    const deal = (await (await browser.send("POST", "/deals", { body: { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }] } })).json()) as { id: string; deliverables: { id: string }[] };
    requests.length = 0;
    return { browser, creatorId: id, dealId: deal.id, post: deal.deliverables[0]!.id };
  }
  return { app, requests, errors, logged, creator };
}

describe("DS-FR-49 a log of requests", () => {
  test("one line for a request, when it is answered: an id, the method, the route's pattern, the status and the time, and nothing else", async () => {
    const world = setUp();

    const response = await world.app.request("/me");

    expect(response.status).toBe(401);
    expect(world.requests).toEqual([{ message: "A request was answered", details: { requestId: expect.any(String), method: "GET", route: "/me", status: 401, ms: expect.any(Number) } }]);
  });

  test("a signed-in creator's request carries their id, and the deal's or the post's id when the route has one", async () => {
    const world = setUp();
    const sam = await world.creator();

    await sam.browser.send("GET", `/deals/${sam.dealId}`);
    await sam.browser.send("GET", `/deliverables/${sam.post}`);

    expect(world.requests.map((line) => line.details)).toEqual([
      { requestId: expect.any(String), method: "GET", route: "/deals/{dealId}", dealId: sam.dealId, creatorId: sam.creatorId, status: 200, ms: expect.any(Number) },
      { requestId: expect.any(String), method: "GET", route: "/deliverables/{deliverableId}", deliverableId: sam.post, creatorId: sam.creatorId, status: 409, ms: expect.any(Number) },
    ]);
  });

  test("DS-BR-15 a brand's token is part of a path, so the path as it was asked for is never logged: only the pattern", async () => {
    const world = setUp();

    await world.app.request("/b/Zm9yLXRoZS1icmFuZC1vbmx5LXNlY3JldA/session", { method: "POST", headers: { origin: APP } });

    expect(world.requests[0]!.details).toMatchObject({ method: "POST", route: "/b/{token}/session" });
    expect(world.logged()).not.toContain("Zm9yLXRoZS1icmFuZC1vbmx5LXNlY3JldA");
  });

  test("DS-BR-15 a query string is never logged: not a one-time code, and not a file's name", async () => {
    const world = setUp();
    const sam = await world.creator();

    await sam.browser.send("POST", `/deliverables/${sam.post}/draft?fileName=my-unreleased-launch.mp4`, { file: { bytes: new Uint8Array(10) } });
    await world.app.request("/me?code=4/0AX4XfWh-one-time-code&state=st4te");

    expect(world.requests.map((line) => line.details.route)).toEqual(["/deliverables/{deliverableId}/draft", "/me"]);
    for (const never of ["my-unreleased-launch", "one-time-code", "st4te", "fileName", "?"]) expect(world.logged()).not.toContain(never);
  });

  test("a path with no route is logged as having none, not as what was typed", async () => {
    const world = setUp();

    const response = await world.app.request("/b/a-mistyped-link-with-a-token-in-it");

    expect(response.status).toBe(404);
    expect(world.requests[0]!.details).toEqual({ requestId: expect.any(String), method: "GET", route: "(no route)", status: 404, ms: expect.any(Number) });
    expect(world.logged()).not.toContain("mistyped");
  });

  test("an id is logged only if it looks like one: anything else typed where an id goes is left out", async () => {
    const world = setUp();
    const sam = await world.creator();

    await sam.browser.send("GET", "/deals/not%20an%20id%3Cscript%3E");

    expect(world.requests[0]!.details).toEqual({ requestId: expect.any(String), method: "GET", route: "/deals/{dealId}", creatorId: sam.creatorId, status: 404, ms: expect.any(Number) });
    expect(world.logged()).not.toContain("script");
  });

  test("PayPal's webhook is logged like any request, with nothing from its body or its headers", async () => {
    const world = setUp();

    await world.app.request("/webhooks/paypal", { method: "POST", headers: { "paypal-transmission-id": "TRANSMISSION-MARKER", "content-type": "application/json" }, body: JSON.stringify({ id: "WH-BODY-MARKER", resource: { payer: "maya@glow.example" } }) });

    expect(world.requests[0]!.details).toMatchObject({ method: "POST", route: "/webhooks/paypal" });
    for (const never of ["WH-BODY-MARKER", "maya@glow.example", "TRANSMISSION-MARKER"]) expect(JSON.stringify(world.requests)).not.toContain(never);
  });

  test("the health check is not logged", async () => {
    const world = setUp();

    expect((await world.app.request("/health")).status).toBe(200);

    expect(world.requests).toEqual([]);
  });

  test("no IP address and no user agent, whatever the request says of itself", async () => {
    const world = setUp();

    await world.app.request("/me", { headers: { "user-agent": "Mozilla/5.0 (a real browser)", "x-forwarded-for": "203.0.113.7", referer: "https://app.sponing.test/deals/secret-looking" } });

    for (const never of ["Mozilla", "203.0.113.7", "secret-looking"]) expect(world.logged()).not.toContain(never);
  });
});

describe("DS-FR-51 a request id on every answer", () => {
  test("each answer carries its own id in a header, the same one its line has: found, refused, missing and failed alike", async () => {
    const world = setUp();
    world.app.get("/boom", () => {
      throw new Error("it broke");
    });

    const answers = [await world.app.request("/health"), await world.app.request("/me"), await world.app.request("/nowhere"), await world.app.request("/boom")];

    const ids = answers.map((answer) => answer.headers.get("x-request-id"));
    expect(answers.map((answer) => answer.status)).toEqual([200, 401, 404, 500]);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(ids).size).toBe(4);
    // The health check has an id and no line.
    expect(world.requests.map((line) => line.details.requestId)).toEqual(ids.slice(1));
  });

  test("the id is made by the service: one a caller sends is not used, and is not logged", async () => {
    const world = setUp();

    const response = await world.app.request("/me", { headers: { "x-request-id": "chosen-by-the-caller" } });

    expect(response.headers.get("x-request-id")).not.toBe("chosen-by-the-caller");
    expect(world.logged()).not.toContain("chosen-by-the-caller");
  });

  test("the app's own pages may read it: it is named among the headers a script on the app can see", async () => {
    const world = setUp();

    const response = await world.app.request("/me", { headers: { origin: APP } });

    expect(response.headers.get("access-control-expose-headers")).toContain("X-Request-Id");
  });
});

describe("DS-FR-50 an error no route handled", () => {
  class DatabaseSaidNo extends Error {
    code = "P2002";
    constructor() {
      super("Unique constraint failed on sam.pay@example.com with token ya29.A0ARrdaM-refresh");
      this.name = "DatabaseSaidNo";
    }
  }
  function failing() {
    const world = setUp();
    world.app.get("/deliverables/:deliverableId/boom", () => {
      throw new DatabaseSaidNo();
    });
    return world;
  }

  test("it is answered 500 in the one error shape, with the code server_error and nothing else", async () => {
    const world = failing();

    const response = await world.app.request("/deliverables/4f0c2d5e-0000-4000-8000-000000000001/boom");

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: { code: "server_error" } });
  });

  test("it is logged once: the request's id, the error's name and code, and where in the code it was thrown", async () => {
    const world = failing();

    const response = await world.app.request("/deliverables/4f0c2d5e-0000-4000-8000-000000000001/boom");

    expect(world.errors).toHaveLength(1);
    const [message, details] = world.errors[0] as [string, string];
    expect(message).toBe("A request failed");
    const said = JSON.parse(details) as { requestId: string; name: string; code: string; at: string[] };
    expect(said).toEqual({ requestId: response.headers.get("x-request-id")!, name: "DatabaseSaidNo", code: "P2002", at: expect.any(Array) });
    expect(said.at[0]).toMatch(/^src\/request-log\.test\.ts:\d+$/);
    for (const place of said.at) expect(place).toMatch(/^[\w./-]+:\d+$/);
  });

  test("DS-BR-15 its message is in neither the answer nor any log line", async () => {
    const world = failing();

    const response = await world.app.request("/deliverables/4f0c2d5e-0000-4000-8000-000000000001/boom");

    const everywhere = `${await response.text()}${world.logged()}`;
    for (const never of ["sam.pay@example.com", "ya29", "Unique constraint"]) expect(everywhere).not.toContain(never);
  });

  test("the failed request still has its line, with the status it was answered with", async () => {
    const world = failing();

    await world.app.request("/deliverables/4f0c2d5e-0000-4000-8000-000000000001/boom");

    expect(world.requests.map((line) => line.details)).toEqual([{ requestId: expect.any(String), method: "GET", route: "/deliverables/{deliverableId}/boom", deliverableId: "4f0c2d5e-0000-4000-8000-000000000001", status: 500, ms: expect.any(Number) }]);
  });

  test("a code that is not a plain code, and a name that is not a plain name, are left out or made plain", async () => {
    const world = setUp();
    world.app.get("/boom", () => {
      const error = new Error("x") as Error & { code: unknown };
      error.name = "Weird name with sam@example.com in it";
      error.code = { nested: "sam.pay@example.com" };
      throw error;
    });

    await world.app.request("/boom");

    expect(world.logged()).not.toContain("example.com");
    expect(JSON.parse((world.errors[0] as [string, string])[1])).not.toHaveProperty("code");
  });
});
