/** Deals, through the app (deal set-up spec DS-FR-13 to DS-FR-16, DS-BR-01). */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor } from "../test/browser";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { prisma } from "./db";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.deal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

function setUp() {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const app = createApp({ prisma, appOrigin: APP, now: clock });
  /** A browser signed in as a creator who came through Google. */
  async function creator(name = "Sam Rivera") {
    const browser = browserFor(app, APP);
    const { creatorId } = await createAccounts({ prisma, now: clock }).signInWithGoogle({
      googleId: `google-${name}`,
      name,
      email: `${name.split(" ")[0]!.toLowerCase()}@example.com`,
    });
    browser.cookies.set("cleared_session", await createSessions({ prisma, now: clock }).start(creatorId));
    return browser;
  }
  return {
    creator,
    stranger: () => browserFor(app, APP),
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

const glow = { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }, { platform: "youtube_short" }] };

describe("DS-FR-13 start a deal", () => {
  test("a creator names the brand and the posts, and the deal starts at the checklist step", async () => {
    const sam = await setUp().creator();

    const response = await sam.send("POST", "/deals", { body: glow });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: expect.any(String),
      brandName: "Glow Skincare",
      step: "checklist",
      deliverables: [
        { id: expect.any(String), platform: "youtube_video" },
        { id: expect.any(String), platform: "youtube_short" },
      ],
      reading: "idle",
      items: [],
      questions: [],
      ready: false,
    });
  });

  test("a deal with a Reel is refused, saying why, because Instagram is not available yet", async () => {
    const sam = await setUp().creator();

    const response = await sam.send("POST", "/deals", {
      body: { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "platform_not_available", field: "deliverables.1.platform" } });
    expect(await prisma.deal.count()).toBe(0);
  });

  test.each([
    ["no brand name", { brandName: "  ", deliverables: [{ platform: "youtube_video" }] }, "brandName"],
    ["a brand name far too long", { brandName: "x".repeat(121), deliverables: [{ platform: "youtube_video" }] }, "brandName"],
    ["no posts", { brandName: "Glow Skincare", deliverables: [] }, "deliverables"],
    ["more than ten posts", { brandName: "Glow Skincare", deliverables: Array(11).fill({ platform: "youtube_short" }) }, "deliverables"],
    ["a platform nobody has heard of", { brandName: "Glow Skincare", deliverables: [{ platform: "tiktok" }] }, "deliverables.0.platform"],
  ])("a deal with %s is refused, naming the field", async (_, body, field) => {
    const sam = await setUp().creator();

    const response = await sam.send("POST", "/deals", { body });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { field } });
    expect(await prisma.deal.count()).toBe(0);
  });

  test("the brand's name is kept as plain text, trimmed (DS-BR-04)", async () => {
    const sam = await setUp().creator();

    const response = await sam.send("POST", "/deals", {
      body: { brandName: '  <b>Glow</b> & "Co"  ', deliverables: [{ platform: "youtube_video" }] },
    });

    expect(await response.json()).toMatchObject({ brandName: '<b>Glow</b> & "Co"' });
  });

  test("it needs a session", async () => {
    expect((await setUp().stranger().send("POST", "/deals", { body: glow })).status).toBe(401);
  });
});

describe("DS-FR-14 the deals list", () => {
  test("a creator's deals, newest first, each with its step, a one-line status and its posts", async () => {
    const world = setUp();
    const sam = await world.creator();
    await sam.send("POST", "/deals", { body: glow });
    world.timeIs("2026-10-09T10:00:00Z");
    await sam.send("POST", "/deals", { body: { brandName: "Pine & Co", deliverables: [{ platform: "youtube_short" }] } });

    const response = await sam.send("GET", "/deals");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: expect.any(String),
        brandName: "Pine & Co",
        status: "Checklist",
        step: "checklist",
        deliverables: [{ id: expect.any(String), platform: "youtube_short", state: "no_draft" }],
      },
      {
        id: expect.any(String),
        brandName: "Glow Skincare",
        status: "Checklist",
        step: "checklist",
        deliverables: [
          { id: expect.any(String), platform: "youtube_video", state: "no_draft" },
          { id: expect.any(String), platform: "youtube_short", state: "no_draft" },
        ],
      },
    ]);
  });

  test("a creator with no deals gets an empty list, and nobody signed in gets a 401", async () => {
    const world = setUp();

    expect(await (await (await world.creator()).send("GET", "/deals")).json()).toEqual([]);
    expect((await world.stranger().send("GET", "/deals")).status).toBe(401);
  });
});

describe("DS-BR-01 a deal is its creator's alone", () => {
  test("another creator's list does not show it", async () => {
    const world = setUp();
    await (await world.creator("Sam Rivera")).send("POST", "/deals", { body: glow });

    expect(await (await (await world.creator("Mo Adeyemi")).send("GET", "/deals")).json()).toEqual([]);
  });

  test("another creator's deal and a deal that does not exist get the same answer", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera");
    const mo = await world.creator("Mo Adeyemi");
    const { id } = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string };

    const someoneElses = await mo.send("GET", `/deals/${id}`);
    const nothingThere = await mo.send("GET", "/deals/00000000-0000-4000-8000-000000000000");

    expect(someoneElses.status).toBe(404);
    expect(await someoneElses.json()).toEqual(await nothingThere.json());
    expect(nothingThere.status).toBe(404);
  });

  test("another creator cannot change it", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera");
    const mo = await world.creator("Mo Adeyemi");
    const { id } = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string };

    const response = await mo.send("PATCH", `/deals/${id}`, { body: { brandName: "Taken Over", deliverables: [{ platform: "youtube_short" }] } });

    expect(response.status).toBe(404);
    expect(await (await sam.send("GET", `/deals/${id}`)).json()).toMatchObject({ brandName: "Glow Skincare" });
  });
});

describe("DS-FR-15 one deal", () => {
  test("its creator reads it back as it stands", async () => {
    const sam = await setUp().creator();
    const made = await (await sam.send("POST", "/deals", { body: glow })).json();

    const response = await sam.send("GET", `/deals/${(made as { id: string }).id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(made);
  });

  test("an id that is not an id is not found, not an error", async () => {
    const sam = await setUp().creator();

    expect((await sam.send("GET", "/deals/not-a-real-id")).status).toBe(404);
  });
});

describe("DS-FR-16 change the brand or the posts", () => {
  test("before the brief is sent, the name and the posts can change; a post sent with its id keeps it", async () => {
    const sam = await setUp().creator();
    const made = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string; deliverables: { id: string }[] };
    const [video, short] = made.deliverables;

    const response = await sam.send("PATCH", `/deals/${made.id}`, {
      body: { brandName: "Glow Skin", deliverables: [{ id: short!.id, platform: "youtube_short" }, { platform: "youtube_video" }] },
    });

    expect(response.status).toBe(200);
    const changed = (await response.json()) as { brandName: string; deliverables: { id: string; platform: string }[] };
    expect(changed.brandName).toBe("Glow Skin");
    expect(changed.deliverables).toEqual([
      { id: short!.id, platform: "youtube_short" },
      { id: expect.any(String), platform: "youtube_video" },
    ]);
    // The first video was dropped, and the new one is a new post.
    expect(changed.deliverables[1]!.id).not.toBe(video!.id);
    expect(await prisma.deliverable.count()).toBe(2);
  });

  test("a post id from another deal is refused", async () => {
    const sam = await setUp().creator();
    const first = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string; deliverables: { id: string }[] };
    const second = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string };

    const response = await sam.send("PATCH", `/deals/${second.id}`, {
      body: { brandName: "Glow Skincare", deliverables: [{ id: first.deliverables[0]!.id, platform: "youtube_video" }] },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "unknown_post", field: "deliverables.0.id" } });
  });

  test("the same rules apply as when starting a deal", async () => {
    const sam = await setUp().creator();
    const made = (await (await sam.send("POST", "/deals", { body: glow })).json()) as { id: string };

    const reel = await sam.send("PATCH", `/deals/${made.id}`, { body: { brandName: "Glow Skincare", deliverables: [{ platform: "instagram_reel" }] } });
    const empty = await sam.send("PATCH", `/deals/${made.id}`, { body: { brandName: "Glow Skincare", deliverables: [] } });

    expect(await reel.json()).toEqual({ error: { code: "platform_not_available", field: "deliverables.0.platform" } });
    expect(empty.status).toBe(400);
  });
});
