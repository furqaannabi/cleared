/** Deals, through the app (deal set-up spec DS-FR-13 to DS-FR-16, DS-BR-01). */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor } from "../test/browser";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import type { BriefModel, ModelReply } from "./briefs/reader";
import { prisma } from "./db";
import { createDeals, defaultDealSettings, type DealSettings } from "./deals/deals";
import { runDueJobs } from "./jobs/jobs";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.briefRead.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

/** What the model answers when a test has not said otherwise: one item for every post, and one question. */
const usualAnswer: ModelReply = {
  ok: true,
  answer: {
    items: [{ line: 2, name: "Say the code GLOW20", kind: "said", appliesTo: "all", exact: "GLOW20" }],
    questions: [
      {
        line: 3,
        question: "Line 3 says 'mention us early'. How early?",
        suggestions: [
          { answer: "In the first 30 seconds", item: { name: "Mention Glow in the first 30 seconds", kind: "timing", appliesTo: "all" } },
          { answer: "In the first 60 seconds", item: { name: "Mention Glow in the first 60 seconds", kind: "timing", appliesTo: "all" } },
        ],
      },
    ],
  },
};

function setUp(settings: Partial<DealSettings> = {}) {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  /** The stand-in model: it gives `reply`, or throws if told to, and remembers what it was asked. */
  const model = {
    reply: usualAnswer as ModelReply | "crash",
    asked: [] as Parameters<BriefModel["read"]>[0][],
    async read(input: Parameters<BriefModel["read"]>[0]): Promise<ModelReply> {
      this.asked.push(input);
      if (this.reply === "crash") throw new Error("the model's client blew up");
      return this.reply;
    },
  };
  const deals = createDeals({ prisma, now: clock, model, settings: { ...defaultDealSettings, ...settings } });
  const app = createApp({ prisma, appOrigin: APP, now: clock, deals });
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
    model,
    /** A browser signed in to a fresh demo account. */
    async demo() {
      const browser = browserFor(app, APP);
      await browser.send("POST", "/auth/demo", { form: true });
      return browser;
    },
    /** Runs every job that is due, as the service's worker would. */
    runJobs: () => runDueJobs(prisma, deals.handlers, { now, log: () => {} }),
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

const brief = ["Hi Sam, thanks for doing this!", "Say the code GLOW20 out loud.", "Mention us early.", "Have fun with it."].join("\n");

type Browser = Awaited<ReturnType<ReturnType<typeof setUp>["creator"]>>;
interface Draft {
  id: string;
  reading: string;
  deliverables: { id: string; platform: string }[];
  brief?: { lines: { number: number; text: string }[] };
  items: { id: string; deliverableId: string; name: string; kind: string; briefLine?: number; addedByCreator: boolean; checkedBy: string }[];
  questions: { id: string; briefLine: number; text: string; suggestions: string[]; answer?: unknown }[];
}

/** Starts a deal and returns it. */
const startDeal = async (browser: Browser) => (await (await browser.send("POST", "/deals", { body: glow })).json()) as Draft;
const sendBrief = (browser: Browser, dealId: string, text = brief) => browser.send("POST", `/deals/${dealId}/brief`, { body: { text } });
const readDeal = async (browser: Browser, dealId: string) => (await (await browser.send("GET", `/deals/${dealId}`)).json()) as Draft;

describe("DS-FR-17 send the brief", () => {
  test("the brief is stored as numbered lines and reading starts", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);

    const response = await sendBrief(sam, deal.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reading: "reading",
      brief: {
        lines: [
          { number: 1, text: "Hi Sam, thanks for doing this!" },
          { number: 2, text: "Say the code GLOW20 out loud." },
          { number: 3, text: "Mention us early." },
          { number: 4, text: "Have fun with it." },
        ],
      },
      items: [],
      questions: [],
    });
    // Nothing has been asked of the model yet: reading is a job.
    expect(world.model.asked).toHaveLength(0);
  });

  test.each([
    ["under 40 characters", "Say GLOW20."],
    ["over 20,000 characters", "word ".repeat(4001)],
    ["only spaces", " ".repeat(60)],
  ])("a brief that is %s is refused, and nothing is stored or read", async (_, text) => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);

    const response = await sendBrief(sam, deal.id, text);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { field: "text" } });
    expect(await readDeal(sam, deal.id)).toMatchObject({ reading: "idle" });
    expect(await prisma.briefRead.count()).toBe(0);
  });

  test("once reading has started the brief cannot be sent again, and the posts can no longer change (DS-FR-16)", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);

    const again = await sendBrief(sam, deal.id);
    const change = await sam.send("PATCH", `/deals/${deal.id}`, { body: glow });

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: { code: "reading_started" } });
    expect(change.status).toBe(409);
    expect(await prisma.briefRead.count()).toBe(1);
  });

  test("another creator cannot send a brief to it", async () => {
    const world = setUp();
    const deal = await startDeal(await world.creator("Sam Rivera"));

    expect((await sendBrief(await world.creator("Mo Adeyemi"), deal.id)).status).toBe(404);
  });
});

describe("DS-FR-18 to DS-FR-21 the brief is read", () => {
  test("the model is given the numbered lines and the kinds of post", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);

    await world.runJobs();

    expect(world.model.asked).toEqual([
      { lines: (await readDeal(sam, deal.id)).brief!.lines, platforms: ["youtube_video", "youtube_short"] },
    ]);
  });

  test("items and questions arrive together, each item on its post, citing its line, with how it is checked", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);

    await world.runJobs();

    const read = await readDeal(sam, deal.id);
    const [video, short] = deal.deliverables;
    expect(read.reading).toBe("done");
    expect(read.items).toEqual([
      { id: expect.any(String), deliverableId: video!.id, name: "Say the code GLOW20", kind: "said", briefLine: 2, addedByCreator: false, checkedBy: "exact_match" },
      { id: expect.any(String), deliverableId: short!.id, name: "Say the code GLOW20", kind: "said", briefLine: 2, addedByCreator: false, checkedBy: "exact_match" },
    ]);
    expect(read.questions).toEqual([
      {
        id: expect.any(String),
        briefLine: 3,
        text: "Line 3 says 'mention us early'. How early?",
        suggestions: ["In the first 30 seconds", "In the first 60 seconds"],
      },
    ]);
  });

  test("the deals list still shows the deal at the checklist step", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);
    await world.runJobs();

    expect(await (await sam.send("GET", "/deals")).json()).toMatchObject([{ id: deal.id, step: "checklist" }]);
  });
});

describe("DS-FR-22 could not read", () => {
  test.each<[string, ModelReply | "crash"]>([
    ["refuses", { ok: false, reason: "refused" }],
    ["runs out of room", { ok: false, reason: "cut_off" }],
    ["cannot be reached", { ok: false, reason: "unavailable" }],
    ["answers in the wrong shape twice", { ok: true, answer: "Here is your checklist!" }],
    ["fails in a way nobody planned for", "crash"],
  ])("when the model %s, the read fails, the brief is kept and nothing is on the checklist", async (_, reply) => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);
    world.model.reply = reply;

    await world.runJobs();

    const read = await readDeal(sam, deal.id);
    expect(read.reading).toBe("failed");
    expect(read.brief!.lines).toHaveLength(4);
    expect(read.items).toEqual([]);
    expect(read.questions).toEqual([]);
  });

  test("the creator can try again, and a good second read replaces the failed one", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);
    world.model.reply = { ok: false, reason: "unavailable" };
    await world.runJobs();

    world.model.reply = usualAnswer;
    expect((await sendBrief(sam, deal.id)).status).toBe(200);
    await world.runJobs();

    expect(await readDeal(sam, deal.id)).toMatchObject({ reading: "done", items: [{ name: "Say the code GLOW20" }, { name: "Say the code GLOW20" }] });
  });

  test("after a failed read the posts can change again (DS-FR-16)", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);
    await sendBrief(sam, deal.id);
    world.model.reply = { ok: false, reason: "refused" };
    await world.runJobs();

    const change = await sam.send("PATCH", `/deals/${deal.id}`, { body: { brandName: "Glow Skin", deliverables: [{ platform: "youtube_short" }] } });

    expect(change.status).toBe(200);
  });
});

describe("DS-FR-26 to DS-FR-28 limits on reading", () => {
  /** Sends a brief on a fresh deal, and has it read. Returns the answer to sending it. */
  async function oneMoreRead(world: ReturnType<typeof setUp>, browser: Browser) {
    const response = await sendBrief(browser, (await startDeal(browser)).id);
    await world.runJobs();
    return response;
  }

  test("a demo account can have 5 briefs read in total; the sixth is refused and reads nothing", async () => {
    const world = setUp();
    const demo = await world.demo();
    for (let read = 0; read < 5; read++) expect((await oneMoreRead(world, demo)).status).toBe(200);

    const sixth = await oneMoreRead(world, demo);

    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: { code: "read_limit", field: "demo" } });
    expect(world.model.asked).toHaveLength(5);
  });

  test("a creator can have 20 read in a day; the next is refused, saying when the limit lifts", async () => {
    const world = setUp({ creatorReadsPerDay: 3 });
    const sam = await world.creator();
    for (let read = 0; read < 3; read++) {
      world.timeIs(`2026-10-09T1${read}:00:00Z`);
      expect((await oneMoreRead(world, sam)).status).toBe(200);
    }

    world.timeIs("2026-10-09T20:00:00Z");
    const next = await oneMoreRead(world, sam);

    expect(next.status).toBe(429);
    // A day after the first of the three.
    expect(await next.json()).toEqual({ error: { code: "read_limit", field: "creator", resetsAt: "2026-10-10T10:00:00.000Z" } });

    world.timeIs("2026-10-10T10:00:01Z");
    expect((await oneMoreRead(world, sam)).status).toBe(200);
  });

  test("across everyone there is a daily total, and one creator reaching it stops the next", async () => {
    const world = setUp({ overallReadsPerDay: 2 });
    await oneMoreRead(world, await world.creator("Sam Rivera"));
    await oneMoreRead(world, await world.creator("Mo Adeyemi"));

    const third = await oneMoreRead(world, await world.creator("Ada Okafor"));

    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ error: { code: "read_limit", field: "overall", resetsAt: expect.any(String) } });
    expect(world.model.asked).toHaveLength(2);
  });

  test("a read that failed after the model was called counts; one that never reached the model does not (DS-BR-16)", async () => {
    const world = setUp({ creatorReadsPerDay: 1 });
    const sam = await world.creator();
    const deal = await startDeal(sam);
    world.model.reply = { ok: false, reason: "refused" };
    await sendBrief(sam, deal.id);
    await world.runJobs();

    expect((await sendBrief(sam, deal.id)).status).toBe(429);

    // A read stopped before the model is called leaves no count behind.
    const mo = await world.creator("Mo Adeyemi");
    const other = await startDeal(mo);
    await sendBrief(mo, other.id);
    await prisma.deal.delete({ where: { id: other.id } });
    await world.runJobs();
    expect(await prisma.briefRead.count({ where: { modelCalled: false } })).toBe(0);
  });
});

/** A deal whose brief has been read: one item on each post, and one question about line 3. */
async function readChecklist(world: ReturnType<typeof setUp>, browser: Browser) {
  const deal = await startDeal(browser);
  await sendBrief(browser, deal.id);
  await world.runJobs();
  return readDeal(browser, deal.id);
}

const answer = (browser: Browser, deal: Draft, body: unknown, question = deal.questions[0]!.id) =>
  browser.send("PUT", `/deals/${deal.id}/questions/${question}`, { body });

describe("DS-FR-23 answer a question", () => {
  test("picking a suggested answer adds the item it carries, on every post it applies to, citing the line", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const response = await answer(sam, deal, { kind: "suggestion", text: "In the first 30 seconds" });

    expect(response.status).toBe(200);
    const after = (await response.json()) as Draft;
    expect(after.questions[0]!.answer).toEqual({ kind: "suggestion", text: "In the first 30 seconds" });
    expect(after.items.filter((item) => item.briefLine === 3)).toEqual([
      { id: expect.any(String), deliverableId: deal.deliverables[0]!.id, name: "Mention Glow in the first 30 seconds", kind: "timing", briefLine: 3, addedByCreator: false, checkedBy: "ai_timestamp" },
      { id: expect.any(String), deliverableId: deal.deliverables[1]!.id, name: "Mention Glow in the first 30 seconds", kind: "timing", briefLine: 3, addedByCreator: false, checkedBy: "ai_timestamp" },
    ]);
    // Answering did not ask the model again.
    expect(world.model.asked).toHaveLength(1);
  });

  test("the creator's own words become the item, citing that line", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const after = (await (await answer(sam, deal, { kind: "own_words", text: "  Mention Glow before the intro ends  " })).json()) as Draft;

    expect(after.questions[0]!.answer).toEqual({ kind: "own_words", text: "Mention Glow before the intro ends" });
    expect(after.items.filter((item) => item.briefLine === 3).map((item) => [item.name, item.kind, item.addedByCreator])).toEqual([
      ["Mention Glow before the intro ends", "timing", false],
      ["Mention Glow before the intro ends", "timing", false],
    ]);
    expect(world.model.asked).toHaveLength(1);
  });

  test("leaving the line out adds nothing, and records that it was left out", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const after = (await (await answer(sam, deal, { kind: "left_out" })).json()) as Draft;

    expect(after.questions[0]!.answer).toEqual({ kind: "left_out" });
    expect(after.items.filter((item) => item.briefLine === 3)).toEqual([]);
  });

  test("answering again replaces the first answer and its item", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    await answer(sam, deal, { kind: "suggestion", text: "In the first 30 seconds" });

    const after = (await (await answer(sam, deal, { kind: "suggestion", text: "In the first 60 seconds" })).json()) as Draft;

    expect(after.items.filter((item) => item.briefLine === 3).map((item) => item.name)).toEqual([
      "Mention Glow in the first 60 seconds",
      "Mention Glow in the first 60 seconds",
    ]);
  });

  test("an answered question can be reopened, which takes its item away", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    await answer(sam, deal, { kind: "suggestion", text: "In the first 30 seconds" });

    const response = await sam.send("DELETE", `/deals/${deal.id}/questions/${deal.questions[0]!.id}`);

    const after = (await response.json()) as Draft;
    expect(response.status).toBe(200);
    expect(after.questions[0]).not.toHaveProperty("answer");
    expect(after.items.filter((item) => item.briefLine === 3)).toEqual([]);
    expect(after.items).toHaveLength(2);
  });

  test.each<[string, unknown, string]>([
    ["a suggestion the question never offered", { kind: "suggestion", text: "Whenever you like" }, "text"],
    ["own words that are empty", { kind: "own_words", text: "   " }, "text"],
    ["own words over 200 characters", { kind: "own_words", text: "x".repeat(201) }, "text"],
    ["a kind of answer that does not exist", { kind: "maybe" }, "kind"],
  ])("%s is refused, naming the field, and nothing changes", async (_, body, field) => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const response = await answer(sam, deal, body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { field } });
    expect(await readDeal(sam, deal.id)).toEqual(deal);
  });

  test("a question from another deal, or another creator's deal, is not found", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera");
    const mo = await world.creator("Mo Adeyemi");
    const sams = await readChecklist(world, sam);
    const mos = await readChecklist(world, mo);

    expect((await answer(mo, sams, { kind: "left_out" })).status).toBe(404);
    expect((await answer(sam, sams, { kind: "left_out" }, mos.questions[0]!.id)).status).toBe(404);
    expect(await readDeal(sam, sams.id)).toEqual(sams);
  });
});

describe("DS-FR-24 edit the checklist", () => {
  test("an item can be reworded, and keeps the line it cites", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    const item = deal.items[0]!;

    const response = await sam.send("PATCH", `/deals/${deal.id}/items/${item.id}`, { body: { name: "  Say GLOW20 clearly  " } });

    expect(response.status).toBe(200);
    expect(((await response.json()) as Draft).items[0]).toEqual({ ...item, name: "Say GLOW20 clearly" });
  });

  test("an item can be removed", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const after = (await (await sam.send("DELETE", `/deals/${deal.id}/items/${deal.items[0]!.id}`)).json()) as Draft;

    expect(after.items).toEqual([deal.items[1]!]);
  });

  test("an item can be copied to another post, keeping its line and how it is checked", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    const [video, short] = deal.deliverables;
    await sam.send("DELETE", `/deals/${deal.id}/items/${deal.items[1]!.id}`);

    const response = await sam.send("POST", `/deals/${deal.id}/items/${deal.items[0]!.id}/copy`, { body: { deliverableId: short!.id } });

    const after = (await response.json()) as Draft;
    expect(after.items).toHaveLength(2);
    expect(after.items[0]).toEqual(deal.items[0]!);
    expect(after.items[1]).toMatchObject({ deliverableId: short!.id, name: "Say the code GLOW20", briefLine: 2, checkedBy: "exact_match", addedByCreator: false });
    expect(after.items[1]!.id).not.toBe(deal.items[0]!.id);
    expect(after.items[0]!.deliverableId).toBe(video!.id);
  });

  test("an item can be moved to another post", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    const short = deal.deliverables[1]!;

    const after = (await (
      await sam.send("POST", `/deals/${deal.id}/items/${deal.items[0]!.id}/move`, { body: { deliverableId: short.id } })
    ).json()) as Draft;

    expect(after.items.map((item) => item.deliverableId)).toEqual([short.id, short.id]);
    expect(after.items[0]!.id).toBe(deal.items[0]!.id);
  });

  test("the creator can add an item of their own, which is marked as not from the brief", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    const video = deal.deliverables[0]!;

    const response = await sam.send("POST", `/deals/${deal.id}/items`, { body: { deliverableId: video.id, name: " Wear the Glow cap ", kind: "shown" } });

    expect(response.status).toBe(200);
    const added = ((await response.json()) as Draft).items.at(-1)!;
    expect(added).toEqual({ id: expect.any(String), deliverableId: video.id, name: "Wear the Glow cap", kind: "shown", addedByCreator: true, checkedBy: "ai_timestamp" });
    expect(added).not.toHaveProperty("briefLine");
  });

  test.each([
    ["written", "at_live_check"],
    ["disclosure", "at_live_check"],
    ["said", "ai_timestamp"],
  ])("how an added %s item is checked is decided by code: %s", async (kind, checkedBy) => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const after = (await (
      await sam.send("POST", `/deals/${deal.id}/items`, { body: { deliverableId: deal.deliverables[0]!.id, name: "An item", kind } })
    ).json()) as Draft;

    expect(after.items.at(-1)).toMatchObject({ kind, checkedBy });
  });

  test.each<[string, (deal: Draft) => [string, string, unknown], string]>([
    ["a new name that is empty", (d) => ["PATCH", `/deals/${d.id}/items/${d.items[0]!.id}`, { name: "  " }], "name"],
    ["a new name over 200 characters", (d) => ["PATCH", `/deals/${d.id}/items/${d.items[0]!.id}`, { name: "x".repeat(201) }], "name"],
    ["an added item of a kind that does not exist", (d) => ["POST", `/deals/${d.id}/items`, { deliverableId: d.deliverables[0]!.id, name: "Dance", kind: "danced" }], "kind"],
    ["an added item on a post that is not this deal's", (d) => ["POST", `/deals/${d.id}/items`, { deliverableId: "someone-elses-post", name: "Dance", kind: "shown" }], "deliverableId"],
    ["a copy to a post that is not this deal's", (d) => ["POST", `/deals/${d.id}/items/${d.items[0]!.id}/copy`, { deliverableId: "someone-elses-post" }], "deliverableId"],
    ["a move to a post that is not this deal's", (d) => ["POST", `/deals/${d.id}/items/${d.items[0]!.id}/move`, { deliverableId: "someone-elses-post" }], "deliverableId"],
  ])("%s is refused, naming the field, and nothing changes", async (_, request, field) => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    const [method, path, body] = request(deal);

    const response = await sam.send(method, path, { body });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { field } });
    expect(await readDeal(sam, deal.id)).toEqual(deal);
  });

  test("an item that is not this deal's, or a deal that is not this creator's, is not found", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera");
    const mo = await world.creator("Mo Adeyemi");
    const sams = await readChecklist(world, sam);
    const mos = await readChecklist(world, mo);

    expect((await mo.send("DELETE", `/deals/${sams.id}/items/${sams.items[0]!.id}`)).status).toBe(404);
    expect((await sam.send("DELETE", `/deals/${sams.id}/items/${mos.items[0]!.id}`)).status).toBe(404);
    expect((await sam.send("PATCH", `/deals/${sams.id}/items/${mos.items[0]!.id}`, { body: { name: "Mine now" } })).status).toBe(404);
    expect(await readDeal(mo, mos.id)).toEqual(mos);
    expect(await readDeal(sam, sams.id)).toEqual(sams);
  });

  test("the checklist cannot be edited before the brief has been read", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await startDeal(sam);

    const response = await sam.send("POST", `/deals/${deal.id}/items`, { body: { deliverableId: deal.deliverables[0]!.id, name: "Wear the cap", kind: "shown" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_editable" } });
  });

  test("the creator's wording is kept as plain text (DS-BR-04)", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const after = (await (
      await sam.send("PATCH", `/deals/${deal.id}/items/${deal.items[0]!.id}`, { body: { name: '<img src=x onerror="alert(1)">' } })
    ).json()) as Draft;

    expect(after.items[0]!.name).toBe('<img src=x onerror="alert(1)">');
  });
});

describe("DS-FR-25 checklist ready", () => {
  const ready = (browser: Browser, deal: Draft) => browser.send("POST", `/deals/${deal.id}/checklist/ready`);

  test("with every question answered and an item on every post, the deal moves to the invite step", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    await answer(sam, deal, { kind: "left_out" });

    const response = await ready(sam, deal);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ step: "invite", ready: true });
    expect(await (await sam.send("GET", "/deals")).json()).toMatchObject([{ step: "invite", status: "Invite" }]);
  });

  test("it is refused while a question is unanswered (DS-BR-08)", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);

    const response = await ready(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "questions_unanswered" } });
    expect(await readDeal(sam, deal.id)).toMatchObject({ step: "checklist", ready: false });
  });

  test("it is refused while a post has no item", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    await answer(sam, deal, { kind: "left_out" });
    await sam.send("DELETE", `/deals/${deal.id}/items/${deal.items[1]!.id}`);

    const response = await ready(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "post_without_items" } });
  });

  test("once ready, the checklist cannot be edited, until it is reopened", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await readChecklist(world, sam);
    await answer(sam, deal, { kind: "left_out" });
    await ready(sam, deal);

    const edit = () => sam.send("PATCH", `/deals/${deal.id}/items/${deal.items[0]!.id}`, { body: { name: "Changed" } });
    expect((await edit()).status).toBe(409);

    const reopened = await sam.send("POST", `/deals/${deal.id}/checklist/reopen`);
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ step: "checklist", ready: false });
    expect((await edit()).status).toBe(200);
  });

  test("a checklist that is not ready cannot be reopened, and another creator can do neither", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera");
    const mo = await world.creator("Mo Adeyemi");
    const deal = await readChecklist(world, sam);

    expect((await sam.send("POST", `/deals/${deal.id}/checklist/reopen`)).status).toBe(409);
    expect((await ready(mo, deal)).status).toBe(404);
    expect((await mo.send("POST", `/deals/${deal.id}/checklist/reopen`)).status).toBe(404);
  });
});
