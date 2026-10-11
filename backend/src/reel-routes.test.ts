/**
 * A Reel in a deal, through the app (Instagram Reels spec IG-FR-07, IG-FR-10, IG-BR-03): it is held,
 * its draft is checked and reviewed as any draft is, and it is never taken down YouTube's path.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const file = { bytes: new Uint8Array(2_000).fill(7) };
type Post = { platform: string; state: string; items: { name: string; kind: string; status: string; checkedBy: string }[]; hold: { stage: string }; [field: string]: unknown };
const REEL = { platforms: ["instagram_reel"] };

/** A held Reel whose draft was sent and checked. */
async function checkedReel(world: HeldWorld) {
  const held = await world.heldPost(REEL);
  expect((await held.sam.send("POST", `/deliverables/${held.post}/draft?fileName=glow-reel.mp4`, { file })).status).toBe(200);
  await world.finishChecks();
  return { ...held, read: async () => (await (await held.sam.send("GET", `/deliverables/${held.post}`)).json()) as Post };
}

describe("IG-FR-07, IG-FR-10 a Reel goes through the hold, the draft check and the review as any post does", () => {
  test("the brand agrees to a deal with a Reel and holds its money, and both sides see it as a Reel", async () => {
    const world = heldWorld();
    const held = await world.heldPost(REEL);

    expect(await world.money.view(held.post)).toMatchObject({ stage: "held" });
    expect(await (await held.sam.send("GET", `/deliverables/${held.post}`)).json()).toMatchObject({ platform: "instagram_reel", state: "no_draft", hold: { stage: "held" } });
    expect(((await (await held.maya.send("GET", `/brand/deals/${held.deal.id}`)).json()) as { posts: { platform: string }[] }).posts.map((post) => post.platform)).toEqual(["instagram_reel"]);
  });

  test("the draft is the file alone: it is checked against the same checklist, and its caption item waits for the live check", async () => {
    const world = heldWorld();
    const reel = await checkedReel(world);

    const read = await reel.read();

    expect(read).toMatchObject({ platform: "instagram_reel", state: "fully_passing", run: 1 });
    expect(read.items.map(({ kind, status, checkedBy }) => ({ kind, status, checkedBy }))).toEqual([
      { kind: "said", status: "passed", checkedBy: "exact_match" },
      { kind: "shown", status: "passed", checkedBy: "ai_timestamp" },
      { kind: "written", status: "at_live_check", checkedBy: "published_post" },
    ]);
    // Nothing of a draft goes near a platform: no upload exists on Instagram before the go-ahead.
    expect(world.youtube.reads).toEqual([]);
  });

  test("the brand reviews and approves it, and the draft is cleared with the money path", async () => {
    const world = heldWorld();
    const reel = await checkedReel(world);

    const approved = await reel.maya.send("POST", `/brand/deals/${reel.deal.id}/deliverables/${reel.post}/approve`);

    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ platform: "instagram_reel", review: { state: "approved", by: "brand" } });
    expect(await reel.read()).toMatchObject({ state: "approved" });
    expect((await world.money.view(reel.post))!.status).toMatchObject({ reason: "ready_to_publish" });
  });

  test("a deal can hold a YouTube video and a Reel, each with its own hold", async () => {
    const world = heldWorld();
    const held = await world.heldPost({ platforms: ["youtube_video", "instagram_reel"] });

    expect(await Promise.all(held.posts.map(async (post) => (await world.money.view(post))!.stage))).toEqual(["held", "held"]);
    expect(new Set(await Promise.all(held.posts.map(async (post) => ((await world.money.view(post))!.hold as { reference: string }).reference))).size).toBe(2);
  });
});

describe("IG-BR-03 a Reel is never taken down YouTube's path", () => {
  const VIDEO = "dQw4w9WgXcQ";
  const paypalCalls = (world: HeldWorld) => world.paypal.calls.length;

  /** An approved Reel, and on the creator's own YouTube channel a video that is the approved file exactly. */
  async function approvedReel(world: HeldWorld) {
    const reel = await checkedReel(world);
    await reel.maya.send("POST", `/brand/deals/${reel.deal.id}/deliverables/${reel.post}/approve`);
    world.youtube.has(VIDEO, { privacy: "public", description: "https://glow.example/sam", paidPromotion: true });
    return reel;
  }

  test("a YouTube video cannot stand in for a Reel at the go-ahead: nothing is read, recorded or asked of PayPal", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const before = paypalCalls(world);

    const response = await reel.sam.send("POST", `/deliverables/${reel.post}/go-ahead`, { body: { videoUrl: `https://youtu.be/${VIDEO}` } });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "not_set_up" } });
    expect(world.youtube.reads).toEqual([]);
    expect(paypalCalls(world)).toBe(before);
    expect(await prisma.postVideo.count()).toBe(0);
    expect((await world.money.view(reel.post))!.goAhead).toEqual({ state: "none" });
  });

  test("nor can a Reel be said to be posted that way: no live check starts and the money path is told nothing", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);

    const response = await reel.sam.send("POST", `/deliverables/${reel.post}/posted`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "not_set_up" } });
    expect(world.youtube.reads).toEqual([]);
    expect(await prisma.liveCheck.count()).toBe(0);
    expect((await world.money.view(reel.post))!.publishedAt).toBeNull();
  });

  test("a Reel nobody could post is released at its deadline, like any post not published in time", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const { deadlineAt } = (await world.money.view(reel.post))!.hold as { deadlineAt: Date };

    world.timeIs(deadlineAt.toISOString());
    await world.runJobs();

    expect(await world.money.view(reel.post)).toMatchObject({ stage: "released", release: { reason: "deadline" } });
    expect(world.youtube.reads).toEqual([]);
  });
});
