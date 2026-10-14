/**
 * A Reel in a deal, through the app (Instagram Reels spec IG-FR-07, IG-FR-10, IG-BR-03): it is held,
 * its draft is checked and reviewed as any draft is, and it is never taken down YouTube's path.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { CAPTION, CODE, LINK, postedReel } from "../test/live-reel";
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

  test("nor can a Reel be said to be posted with a YouTube video: no live check starts and the money path is told nothing", async () => {
    const world = heldWorld();
    const reel = await approvedReel(world);

    const response = await reel.sam.send("POST", `/deliverables/${reel.post}/posted`, { body: { url: `https://youtu.be/${VIDEO}` } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "not_an_instagram_link", field: "url" } });
    expect(world.youtube.reads).toEqual([]);
    expect(await prisma.liveCheck.count()).toBe(0);
    expect((await world.money.view(reel.post))!.publishedAt).toBeNull();
  });

  test("a YouTube post takes no link when it is said to be posted", async () => {
    const world = heldWorld();
    const held = await world.heldPost();

    const withLink = await held.sam.send("POST", `/deliverables/${held.post}/posted`, { body: { url: "https://www.instagram.com/reel/DAbC1dEfGhI/" } });
    const empty = await held.sam.send("POST", `/deliverables/${held.post}/posted`, { body: {} });

    expect(withLink.status).toBe(400);
    expect(await withLink.json()).toEqual({ error: { code: "invalid", field: "url" } });
    // An empty body asks the same as none: there is no video given for a go-ahead yet.
    expect(await empty.json()).toEqual({ error: { code: "no_video" } });
    expect(world.instagram.searches).toEqual([]);
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
    // The hold ends on PayPal's side without Sponing knowing.
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

const waiting = () => prisma.job.count({ where: { name: "live_check", status: "pending" } });

describe("IG-FR-14 to IG-FR-16 \"I've posted it\", with the Reel's link", () => {
  test("the Reel is found among the creator's own media and recorded, the money path is told, and the live check starts", async () => {
    const world = heldWorld();
    const reel = await postedReel(world);
    world.timeIs("2026-10-09T12:00:00Z");

    const response = await reel.posted();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      platform: "instagram_reel",
      state: "published",
      post: { url: `https://www.instagram.com/reel/${CODE}/`, publishedAt: "2026-10-09T12:00:00.000Z" },
      liveCheck: { state: "checking" },
    });
    expect(world.instagram.searches).toEqual([{ token: "ig-token-sam", shortCode: CODE, searched: 100 }]);
    expect(await reel.recorded()).toMatchObject({ videoId: reel.media!.id, shortCode: CODE, link: `https://www.instagram.com/reel/${CODE}/`, fileMatch: "pending", seenPublicAt: new Date("2026-10-09T12:00:00Z") });
    expect((await reel.money()).publishedAt).toEqual(new Date("2026-10-09T12:00:00Z"));
    expect(await reel.check()).toMatchObject({ running: true, answer: null });
    expect(await waiting()).toBe(1);
  });

  test("IG-BR-08 the link the creator typed is never fetched, and YouTube has no part in it", async () => {
    const world = heldWorld();
    const reel = await postedReel(world);

    await reel.posted();

    expect(world.downloads).toEqual([]);
    expect(world.youtube.reads).toEqual([]);
  });

  test.each([
    ["text that is not a link", "my reel", 400, { code: "not_an_instagram_link", field: "url" }],
    ["a profile, not a Reel", "https://www.instagram.com/sam/", 400, { code: "not_an_instagram_link", field: "url" }],
    ["another site dressed as Instagram", `https://www.instagram.com.evil.example/reel/${CODE}/`, 400, { code: "not_an_instagram_link", field: "url" }],
    ["no link at all", null, 400, { code: "invalid", field: "url" }],
  ])("%s is refused, and Instagram is not asked", async (_what, url, status, error) => {
    const world = heldWorld();
    const reel = await postedReel(world);

    const response = await reel.posted(url);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(world.instagram.searches).toEqual([]);
    expect(await reel.recorded()).toBeNull();
  });

  test("IG-BR-07 a Reel on someone else's account is not found, whatever the link says", async () => {
    const world = heldWorld();
    const reel = await postedReel(world, { onInstagram: false });
    await world.creator("Ada Okafor");
    world.instagram.hasPost("ig-ada", CODE, { caption: CAPTION });

    const response = await reel.posted();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "reel_not_found" } });
    expect(await reel.recorded()).toBeNull();
    expect((await reel.money()).publishedAt).toBeNull();
    expect(await waiting()).toBe(0);
  });

  test("a post on the creator's account that is not a Reel is said not to be one", async () => {
    const world = heldWorld();
    const reel = await postedReel(world, { onInstagram: { isReel: false } });

    const response = await reel.posted(`https://www.instagram.com/p/${CODE}/`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_a_reel" } });
    expect(await reel.recorded()).toBeNull();
  });

  test.each([
    ["the creator's access to Instagram no longer works", (world: HeldWorld) => void world.instagram.lost.add("ig-token-sam"), 409, "reconnect_instagram"],
    ["Instagram itself fails", (world: HeldWorld) => void (world.instagram.down = true), 503, "instagram_unavailable"],
  ])("when %s the answer says so, and nothing changes", async (_what, happens, status, code) => {
    const world = heldWorld();
    const reel = await postedReel(world);
    happens(world);

    const response = await reel.posted();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: { code } });
    expect(await reel.recorded()).toBeNull();
    expect((await reel.money()).publishedAt).toBeNull();
    expect(await waiting()).toBe(0);
  });

  test("saying so again starts nothing new, and a different Reel cannot be given once one is recorded", async () => {
    const world = heldWorld();
    const reel = await postedReel(world);
    world.instagram.hasPost("ig-sam", "AnotherReel1", { caption: CAPTION });
    await reel.posted();
    world.instagram.searches.length = 0;

    expect((await reel.posted()).status).toBe(200);
    const other = await reel.posted("https://www.instagram.com/reel/AnotherReel1/");

    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ error: { code: "already_published" } });
    expect(await waiting()).toBe(1);
    expect(world.instagram.searches).toEqual([]);
    expect(await reel.recorded()).toMatchObject({ shortCode: CODE });
  });

  test("IG-BR-11 only the Reel's own creator can say so", async () => {
    const world = heldWorld();
    const reel = await postedReel(world);

    expect((await reel.posted(LINK, await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await reel.posted(LINK, reel.maya)).status).toBe(401);
    expect(world.instagram.searches).toEqual([]);
    expect(await reel.recorded()).toBeNull();
  });
});

describe("IG-FR-17 a Reel's link is taken once the draft is approved, with or without a go-ahead", () => {
  test("posted without asking for the go-ahead, at the creator's own risk: it is recorded and checked all the same", async () => {
    const world = heldWorld();
    const reel = await postedReel(world, { goAhead: false });

    expect((await reel.posted()).status).toBe(200);

    expect(await reel.recorded()).toMatchObject({ shortCode: CODE });
    expect(await waiting()).toBe(1);
  });

  test("before the draft is approved there is nothing to post, and Instagram is not asked", async () => {
    const world = heldWorld();
    const reel = await checkedReel(world);
    world.instagram.hasPost("ig-sam", CODE);

    const response = await reel.sam.send("POST", `/deliverables/${reel.post}/posted`, { body: { url: LINK } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_approved" } });
    expect(world.instagram.searches).toEqual([]);
  });
});
