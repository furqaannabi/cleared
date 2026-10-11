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

  test("a link is not taken for a Reel: a YouTube video cannot stand in for it, and nothing is read, recorded or asked of PayPal", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const before = paypalCalls(world);

    const response = await reel.sam.send("POST", `/deliverables/${reel.post}/go-ahead`, { body: { videoUrl: `https://youtu.be/${VIDEO}` } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid", field: "videoUrl" } });
    expect(world.youtube.reads).toEqual([]);
    expect(world.instagram.reads).toEqual([]);
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

  test("a YouTube post still needs its video's link", async () => {
    const world = heldWorld();
    const held = await world.heldPost();
    await held.sam.send("POST", `/deliverables/${held.post}/draft?fileName=glow.mp4`, { file });
    await world.finishChecks();
    await held.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${held.post}/approve`);

    for (const response of [await held.sam.send("POST", `/deliverables/${held.post}/go-ahead`), await held.sam.send("POST", `/deliverables/${held.post}/go-ahead`, { body: {} })]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "videoUrl" } });
    }
    expect(world.instagram.reads).toEqual([]);
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

describe("IG-FR-11, IG-FR-12 a Reel's go-ahead: the account is read, then the hold is re-confirmed", () => {
  const paypalCalls = (world: HeldWorld) => world.paypal.calls.length;

  /** An approved Reel, ready for its creator to ask. */
  async function approvedReel(world: HeldWorld, options: { approve?: boolean } = {}) {
    const reel = await checkedReel(world);
    if (options.approve !== false) expect((await reel.maya.send("POST", `/brand/deals/${reel.deal.id}/deliverables/${reel.post}/approve`)).status).toBe(200);
    return { ...reel, goAhead: (browser = reel.sam, body?: Record<string, unknown>) => browser.send("POST", `/deliverables/${reel.post}/go-ahead`, body ? { body } : undefined) };
  }

  test("no link is given: with the account readable, the hold is confirmed and the creator can post until a stated time", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const before = paypalCalls(world);

    const response = await reel.goAhead();

    expect(response.status).toBe(200);
    const read = (await response.json()) as Post & { goAhead: { state: string; endsAt: string } };
    expect(read.goAhead).toEqual({ state: "go", endsAt: expect.any(String) });
    expect(new Date(read.goAhead.endsAt).getTime()).toBeGreaterThan(world.now().getTime());
    expect(read).toMatchObject({ platform: "instagram_reel", state: "posting", hold: { stage: "confirmed" } });
    expect(world.instagram.reads).toEqual(["ig-token-sam"]);
    expect(paypalCalls(world)).toBe(before + 1);
    // Nothing is on Instagram to point at yet, so nothing is recorded as the post, and YouTube has no part in it.
    expect(await prisma.postVideo.count()).toBe(0);
    expect(world.youtube.reads).toEqual([]);
  });

  test("an empty body asks the same", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);

    expect((await reel.goAhead(reel.sam, {})).status).toBe(200);
  });

  test("before the draft is approved there is no go-ahead, and neither Instagram nor PayPal is asked", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world, { approve: false });
    const before = paypalCalls(world);

    const response = await reel.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_approved" } });
    expect(world.instagram.reads).toEqual([]);
    expect(paypalCalls(world)).toBe(before);
  });

  test("IG-BR-11 only the Reel's own creator can ask", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);

    expect((await reel.goAhead(await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await reel.goAhead(reel.maya)).status).toBe(401);
    expect((await reel.goAhead(world.visitor())).status).toBe(401);
    expect(world.instagram.reads).toEqual([]);
    expect((await world.money.view(reel.post))!.goAhead).toEqual({ state: "none" });
  });

  test("the money path's answer is passed on as it is: a hold PayPal cannot confirm gives no go-ahead, and the creator can ask again", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const hold = (await world.money.view(reel.post))!.hold;
    // The hold ends on PayPal's side without Cleared knowing.
    await world.paypal.cancelHold(hold.state === "held" ? hold.reference : "");

    const response = await reel.goAhead();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: "approved", goAhead: { state: "not_confirmed" }, hold: { stage: "held" } });
    expect((await reel.goAhead()).status).toBe(200);
  });

  test("a Reel whose hold was released gets no go-ahead, and Instagram is not asked", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    await world.money.cancel(reel.post, "brand");

    const response = await reel.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_held" } });
    expect(world.instagram.reads).toEqual([]);
  });

  test("asking again while a go-ahead runs answers the same, and PayPal is not asked again", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const first = ((await (await reel.goAhead()).json()) as { goAhead: unknown }).goAhead;
    const before = paypalCalls(world);

    const again = await reel.goAhead();

    expect(((await again.json()) as { goAhead: unknown }).goAhead).toEqual(first);
    expect(paypalCalls(world)).toBe(before);
  });

  test("IG-FR-18 when the go-ahead ends and no Reel's link was given, nothing is seen published: the go-ahead ends, and Instagram is not searched", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    const { endsAt } = ((await (await reel.goAhead()).json()) as { goAhead: { endsAt: string } }).goAhead;
    world.instagram.reads.length = 0;

    world.timeIs(endsAt);
    await world.runJobs();

    expect(await world.money.view(reel.post)).toMatchObject({ publishedAt: null, goAhead: { state: "ended" } });
    expect(world.instagram.reads).toEqual([]);
  });
});

describe("IG-FR-13 lost access to Instagram", () => {
  const paypalCalls = (world: HeldWorld) => world.paypal.calls.length;
  async function approvedReel(world: HeldWorld) {
    const reel = await checkedReel(world);
    await reel.maya.send("POST", `/brand/deals/${reel.deal.id}/deliverables/${reel.post}/approve`);
    return { ...reel, goAhead: () => reel.sam.send("POST", `/deliverables/${reel.post}/go-ahead`) };
  }
  const stored = () => prisma.connectedAccount.findFirstOrThrow({ where: { platform: "instagram", name: "sam" } });

  test.each([
    ["the creator's access no longer works", async (world: HeldWorld) => void world.instagram.lost.add("ig-token-sam")],
    ["no access is stored for the account", async () => void (await prisma.connectedAccount.update({ where: { id: (await stored()).id }, data: { refreshTokenEncrypted: null, tokenExpiresAt: null } }))],
    ["the stored access belongs to a different account", async () => void (await prisma.connectedAccount.update({ where: { id: (await stored()).id }, data: { externalId: "ig-someone-else" } }))],
    ["Instagram is not connected at all", async () => void (await prisma.connectedAccount.delete({ where: { id: (await stored()).id } }))],
  ])("when %s, the go-ahead is refused with \"reconnect Instagram\", and PayPal is not asked", async (_what, happens) => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    await happens(world);
    const before = paypalCalls(world);

    const response = await reel.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "reconnect_instagram" } });
    expect(paypalCalls(world)).toBe(before);
    expect((await world.money.view(reel.post))!.goAhead).toEqual({ state: "none" });
    expect(JSON.stringify(world.logged)).not.toContain("ig-token-sam");
  });

  test("when Instagram itself fails, the creator is asked to try again, and PayPal is not asked", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);
    world.instagram.down = true;
    const before = paypalCalls(world);

    const response = await reel.goAhead();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "instagram_unavailable" } });
    expect(paypalCalls(world)).toBe(before);

    world.instagram.down = false;
    expect((await reel.goAhead()).status).toBe(200);
  });
});
