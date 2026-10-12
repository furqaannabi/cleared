/**
 * A post that was never held, as both sides see it (account and history spec AH-FR-01 to AH-FR-04):
 * the hold says it is not held and why, a declined hold says when PayPal simply never answered, and
 * the creator's list of deals carries the reason a post is closed and which posts wait on the creator.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";

beforeEach(resetDatabase);

type Hold = { state: string; because?: string; reason?: string; reference?: string; deadline?: string };
type Listed = { id: string; deliverables: { id: string; state: string; needsCreator: boolean; closedBecause?: string }[] };
const json = async <Body>(response: Response) => (await response.json()) as Body;
/** The post's hold as each side's page shows it. */
const holds = async (deal: { sam: Browser; maya: Browser; deal: { id: string } }) => ({
  creator: (await json<{ posts: { hold: Hold }[] }>(await deal.sam.send("GET", `/deals/${deal.deal.id}/invite`))).posts[0]!.hold,
  brand: (await json<{ posts: { hold: Hold }[] }>(await deal.maya.send("GET", `/brand/deals/${deal.deal.id}`))).posts[0]!.hold,
});
const listed = async (sam: Browser) => (await json<Listed[]>(await sam.send("GET", "/deals")))[0]!.deliverables;
const laterBy = (world: HeldWorld, hours: number) => world.timeIs(new Date(world.now().getTime() + hours * 3600 * 1000).toISOString());

describe("AH-FR-01 a post closed without a hold", () => {
  test("7 days after the brand agreed with nothing held, the creator sees it as not held, because it never was", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });
    expect(await holds(deal)).toEqual({ creator: { state: "not_started" }, brand: { state: "not_started" } });

    laterBy(world, 7 * 24 + 1);
    await world.runJobs();

    expect((await json<{ posts: { hold: Hold }[] }>(await deal.sam.send("GET", `/deals/${deal.deal.id}/invite`))).posts[0]!.hold).toEqual({ state: "not_held", because: "never_held" });
  });

  test("and so does the brand, when it comes back by the link to a draft of the post it did hold", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false, platforms: ["youtube_video", "youtube_short"] });
    const [video] = deal.posts as [string, string];
    const hold = `/brand/deals/${deal.deal.id}/posts/${video}/hold`;
    const { orderId } = await json<{ orderId: string }>(await deal.maya.send("POST", hold));
    world.paypal.brandApproves(orderId);
    expect((await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } })).status).toBe(200);
    // The brand's first link has run out by now. A draft of the held post gives it a fresh one.
    laterBy(world, 7 * 24 + 1);
    await world.runJobs();
    await deal.sam.send("POST", `/deliverables/${video}/draft?fileName=glow.mp4`, { file: { bytes: new Uint8Array(2_000).fill(7) } });
    await world.finishChecks();
    const { reviewLink } = await json<{ reviewLink: { url: string } }>(await deal.sam.send("GET", `/deliverables/${video}`));
    const maya = world.visitor();
    expect((await maya.send("POST", `/b/${reviewLink.url.split("/b/")[1]}/session`)).status).toBe(200);

    const seen = await json<{ posts: { hold: Hold }[] }>(await maya.send("GET", `/brand/deals/${deal.deal.id}`));

    expect(seen.posts.map((post) => post.hold)).toEqual([{ state: "held", reference: expect.any(String), deadline: expect.any(String) }, { state: "not_held", because: "never_held" }]);
  });

  test("cancelled before it was held, both sides see it as not held, because it was cancelled", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });

    expect((await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${deal.post}/cancel`, { body: {} })).status).toBe(200);

    expect(await holds(deal)).toEqual({ creator: { state: "not_held", because: "cancelled" }, brand: { state: "not_held", because: "cancelled" } });
  });
});

describe("AH-FR-02 a declined hold says why", () => {
  /** The brand approved at PayPal, and PayPal answers the hold as the test says. */
  async function approvedWith(world: HeldWorld, answer: "declined" | "pending") {
    const deal = await world.heldPost({ held: false });
    const hold = `/brand/deals/${deal.deal.id}/posts/${deal.post}/hold`;
    const { orderId } = await json<{ orderId: string }>(await deal.maya.send("POST", hold));
    world.paypal.brandApproves(orderId);
    world.paypal.next("authorizeOrder", answer);
    expect((await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } })).status).toBe(200);
    return { ...deal, hold };
  }

  test("PayPal declined it: both sides are told, and the brand can try again", async () => {
    const world = heldWorld();
    const deal = await approvedWith(world, "declined");

    expect(await holds(deal)).toEqual({ creator: { state: "declined", reason: "paypal_declined" }, brand: { state: "declined", reason: "paypal_declined" } });
    expect((await deal.maya.send("POST", deal.hold)).status).toBe(200);
  });

  test("PayPal gave no answer in 24 hours: it timed out, nothing was taken, and the brand can try again", async () => {
    const world = heldWorld();
    const deal = await approvedWith(world, "pending");
    expect(await holds(deal)).toEqual({ creator: { state: "pending" }, brand: { state: "pending" } });

    laterBy(world, 25);
    await world.runJobs();

    expect(await holds(deal)).toEqual({ creator: { state: "declined", reason: "timed_out" }, brand: { state: "declined", reason: "timed_out" } });
    expect(world.paypal.holds()).toEqual([]);
    expect((await deal.maya.send("POST", deal.hold)).status).toBe(200);
  });
});

describe("AH-FR-03 the creator's list of deals says why a post is closed", () => {
  test("a post never held is closed because it never was; one cancelled, because it was cancelled; an open post says nothing", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false, platforms: ["youtube_video", "youtube_short", "instagram_reel"] });
    const [video, short, reel] = deal.posts as [string, string, string];
    // The video is cancelled, the Reel is held, and the Short is left until its 7 days are up.
    expect((await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${video}/cancel`, { body: {} })).status).toBe(200);
    const hold = `/brand/deals/${deal.deal.id}/posts/${reel}/hold`;
    const { orderId } = await json<{ orderId: string }>(await deal.maya.send("POST", hold));
    world.paypal.brandApproves(orderId);
    expect((await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } })).status).toBe(200);
    expect((await listed(deal.sam)).map(({ state, closedBecause }) => ({ state, closedBecause }))).toEqual([
      { state: "closed", closedBecause: "cancelled" },
      { state: "no_draft", closedBecause: undefined },
      { state: "no_draft", closedBecause: undefined },
    ]);

    laterBy(world, 7 * 24 + 1);
    await world.runJobs();

    const after = await listed(deal.sam);
    expect(after.find((post) => post.id === short)).toMatchObject({ state: "closed", closedBecause: "never_held" });
    expect(after.find((post) => post.id === video)).toMatchObject({ state: "closed", closedBecause: "cancelled" });
    expect(after.find((post) => post.id === reel)).not.toHaveProperty("closedBecause");
  });
});

describe("AH-FR-04 each post on the list says whether it waits on the creator", () => {
  test("a held post with no draft waits on the creator; while its draft is with the brand it does not; a post not held, or closed, never does", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false, platforms: ["youtube_video", "youtube_short"] });
    const [video, short] = deal.posts as [string, string];
    const waits = async () => Object.fromEntries((await listed(deal.sam)).map((post) => [post.id, post.needsCreator]));
    // Nothing is held yet: the next step is the brand's.
    expect(await waits()).toEqual({ [video]: false, [short]: false });

    const hold = `/brand/deals/${deal.deal.id}/posts/${video}/hold`;
    const { orderId } = await json<{ orderId: string }>(await deal.maya.send("POST", hold));
    world.paypal.brandApproves(orderId);
    await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } });
    expect(await waits()).toEqual({ [video]: true, [short]: false });

    // Its draft passes every item: the review window is the brand's.
    await deal.sam.send("POST", `/deliverables/${video}/draft?fileName=glow.mp4`, { file: { bytes: new Uint8Array(2_000).fill(7) } });
    await world.finishChecks();
    expect((await listed(deal.sam)).find((post) => post.id === video)).toMatchObject({ state: "fully_passing", needsCreator: false });

    await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${short}/cancel`, { body: {} });
    expect((await waits())[short]).toBe(false);
  });

  test("a deal still being set up lists its posts as not waiting: the step is the deal's, not a post's", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    await sam.send("POST", "/deals", { body: { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }] } });

    expect((await listed(sam)).map((post) => post.needsCreator)).toEqual([false]);
  });
});
