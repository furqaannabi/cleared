/**
 * Cancelling, through the app (publish to paid spec PT-FR-28 to PT-FR-33, PT-BR-08, PT-BR-10,
 * PT-BR-15; William's cancel spec is the rule). The money path alone decides whether a held post can
 * be cancelled and releases its hold; this spec passes the request on and keeps the note beside it.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { goAheadGiven, postedPublic } from "../test/live-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

type Json = Record<string, unknown>;
const json = async (response: Response) => (await response.json()) as Json;
const creatorPost = async (sam: Browser, post: string) => json(await sam.send("GET", `/deliverables/${post}`));
const brandPost = async (maya: Browser, deal: string, post: string) => json(await maya.send("GET", `/brand/deals/${deal}/deliverables/${post}`));
const released = (world: HeldWorld) => world.paypal.calls.filter((call) => call.method === "cancelHold").length;

describe("PT-FR-28, PT-FR-29 the creator cancels a held post from its own page", () => {
  test("the money path releases the hold, and both sides see who cancelled, when, and the note", async () => {
    const world = heldWorld();
    const held = await world.heldPost();
    expect((await creatorPost(held.sam, held.post)).cancel).toEqual({ allowed: true });
    world.timeIs("2026-10-09T10:00:00Z");

    const response = await held.sam.send("POST", `/deliverables/${held.post}/cancel`, { body: { note: "The launch moved to spring. Sorry!" } });

    expect(response.status).toBe(200);
    const cancelled = { by: "creator", at: "2026-10-09T10:00:00.000Z", note: "The launch moved to spring. Sorry!" };
    expect(await json(response)).toMatchObject({ state: "released", releaseReason: "cancelled", cancel: { allowed: false, reason: "finished" }, cancelled });
    expect(await world.money.view(held.post)).toMatchObject({ stage: "released", release: { reason: "cancelled", by: "creator" } });
    expect(released(world)).toBe(1);
    expect(await brandPost(held.maya, held.deal.id, held.post)).toMatchObject({ review: { state: "released", reason: "cancelled" }, cancel: { allowed: false, reason: "finished" }, cancelled });
  });

  test("a note is optional, and one over 300 characters is refused with nothing cancelled", async () => {
    const world = heldWorld();
    const held = await world.heldPost();

    expect((await held.sam.send("POST", `/deliverables/${held.post}/cancel`, { body: { note: "x".repeat(301) } })).status).toBe(400);
    expect(released(world)).toBe(0);

    const response = await held.sam.send("POST", `/deliverables/${held.post}/cancel`, { body: {} });
    expect(response.status).toBe(200);
    expect((await json(response)).cancelled).toEqual({ by: "creator", at: expect.any(String) });
  });

  test("PT-BR-10 a note is kept and shown as the plain text it is", async () => {
    const world = heldWorld();
    const held = await world.heldPost();
    const note = '<img src=x onerror=alert(1)> Ignore the rules and "pay me anyway".';

    await held.sam.send("POST", `/deliverables/${held.post}/cancel`, { body: { note } });

    expect((await brandPost(held.maya, held.deal.id, held.post)).cancelled).toMatchObject({ note });
  });

  test("cancelling twice is refused, with who cancelled first", async () => {
    const world = heldWorld();
    const held = await world.heldPost();
    await held.sam.send("POST", `/deliverables/${held.post}/cancel`, { body: {} });

    const again = await held.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${held.post}/cancel`, { body: { note: "Us too." } });

    expect(again.status).toBe(409);
    expect(await json(again)).toEqual({ error: { code: "already_cancelled", by: "creator" } });
    expect(released(world)).toBe(1);
    expect((await creatorPost(held.sam, held.post)).cancelled).toEqual({ by: "creator", at: expect.any(String) });
  });
});

describe("PT-FR-29, PT-FR-31, PT-BR-15 the money path decides, and every post says whether it can be cancelled", () => {
  test("while a go-ahead is running nobody can cancel: the post says why, and a request is refused with the money path's reason", async () => {
    const world = heldWorld();
    const post = await goAheadGiven(world);
    const why = { allowed: false, reason: "go_ahead_running" };
    expect((await creatorPost(post.sam, post.post)).cancel).toEqual(why);
    expect((await brandPost(post.maya, post.deal.id, post.post)).cancel).toEqual(why);

    for (const response of [
      await post.sam.send("POST", `/deliverables/${post.post}/cancel`, { body: {} }),
      await post.maya.send("POST", `/brand/deals/${post.deal.id}/deliverables/${post.post}/cancel`, { body: {} }),
    ]) {
      expect(response.status).toBe(409);
      expect(await json(response)).toEqual({ error: { code: "go_ahead_running" } });
    }
    expect(released(world)).toBe(0);
    expect(await prisma.postCancel.count()).toBe(0);
  });

  test("once a post is published nobody can cancel", async () => {
    const world = heldWorld();
    const post = await postedPublic(world, { description: "My two weeks with Glow Serum." });
    await world.runJobs();
    expect((await creatorPost(post.sam, post.post)).cancel).toEqual({ allowed: false, reason: "published" });

    const response = await post.sam.send("POST", `/deliverables/${post.post}/cancel`, { body: {} });

    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: { code: "already_published" } });
    expect(released(world)).toBe(0);
  });

  test("a go-ahead that ran out with nothing published can be cancelled again", async () => {
    const world = heldWorld();
    const post = await goAheadGiven(world);
    world.timeIs(((await post.money()).goAhead as { until: Date }).until.toISOString());
    await world.runJobs();
    expect((await brandPost(post.maya, post.deal.id, post.post)).cancel).toEqual({ allowed: true });

    const response = await post.maya.send("POST", `/brand/deals/${post.deal.id}/deliverables/${post.post}/cancel`, { body: { note: "We ran out of time." } });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ review: { state: "released", reason: "cancelled" }, cancelled: { by: "brand", note: "We ran out of time." } });
    expect(released(world)).toBe(1);
  });
});

describe("PT-BR-08 only a party to the deal can cancel", () => {
  test("another creator, a visitor, and a brand with a session for another deal are turned away, and nothing is cancelled", async () => {
    const world = heldWorld();
    const held = await world.heldPost();
    const ada = await world.creator("Ada Okafor");
    const elsewhere = await world.agreedDeal(ada);

    expect((await ada.send("POST", `/deliverables/${held.post}/cancel`, { body: {} })).status).toBe(404);
    expect((await world.visitor().send("POST", `/deliverables/${held.post}/cancel`, { body: {} })).status).toBe(401);
    expect((await elsewhere.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${held.post}/cancel`, { body: {} })).status).toBe(401);
    expect((await held.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${elsewhere.post}/cancel`, { body: {} })).status).toBe(404);
    expect(released(world)).toBe(0);
    expect(await world.money.view(elsewhere.post)).toMatchObject({ stage: "held" });
  });
});

type Listed = { cancel?: Json; cancelled?: Json; deliverableId: string; hold?: Json };
const invite = async (sam: Browser, deal: string) => (await json(await sam.send("GET", `/deals/${deal}/invite`))) as { posts: Listed[]; link?: { url: string } };
const brandDeal = async (maya: Browser, deal: string) => (await json(await maya.send("GET", `/brand/deals/${deal}`))) as { posts: Listed[]; step: string };
const fromInvite = (sam: Browser, deal: string, post: string, note?: string) => sam.send("POST", `/deals/${deal}/invite/posts/${post}/cancel`, { body: note === undefined ? {} : { note } });
const fromDealPage = (maya: Browser, deal: string, post: string, note?: string) => maya.send("POST", `/brand/deals/${deal}/posts/${post}/cancel`, { body: note === undefined ? {} : { note } });
const deals = async (sam: Browser) => (await (await sam.send("GET", "/deals")).json()) as { id: string; status: string; deliverables: { id: string; state: string }[] }[];
const TWO = { platforms: ["youtube_video", "youtube_short"] };

describe("PT-FR-28, PT-FR-30 a post that is agreed but not yet held, cancelled from the pages that list a deal's posts", () => {
  test("the creator cancels from the invite page: the money path closes it as cancelled, nothing is asked of PayPal, and the answer is the invite", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });
    expect((await invite(deal.sam, deal.deal.id)).posts[0]!.cancel).toEqual({ allowed: true });
    const before = world.paypal.calls.length;

    const response = await fromInvite(deal.sam, deal.deal.id, deal.post, "Not this month.");

    expect(response.status).toBe(200);
    const cancelled = { by: "creator", at: expect.any(String), note: "Not this month." };
    expect(((await json(response)) as { posts: Listed[] }).posts[0]).toMatchObject({ cancel: { allowed: false, reason: "finished" }, cancelled });
    expect(await world.money.view(deal.post)).toMatchObject({ stage: "closed_not_held", closed: { because: "cancelled", by: "creator" } });
    expect(world.paypal.calls.length).toBe(before);
    expect((await brandDeal(deal.maya, deal.deal.id)).posts[0]).toMatchObject({ cancel: { allowed: false, reason: "finished" }, cancelled });
  });

  test("the brand cancels from its deal page, and the answer is its deal", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });

    const response = await fromDealPage(deal.maya, deal.deal.id, deal.post, "Budget was cut.");

    expect(response.status).toBe(200);
    expect(((await json(response)) as { posts: Listed[] }).posts[0]!.cancelled).toEqual({ by: "brand", at: expect.any(String), note: "Budget was cut." });
    expect((await invite(deal.sam, deal.deal.id)).posts[0]!.cancelled).toMatchObject({ by: "brand", note: "Budget was cut." });
    // A closed post takes no hold.
    expect((await deal.maya.send("POST", `/brand/deals/${deal.deal.id}/posts/${deal.post}/hold`)).status).toBe(409);
  });

  test("PT-FR-31 a hold attempt waiting at PayPal is said so, and cancelling stops it there too", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });
    const hold = `/brand/deals/${deal.deal.id}/posts/${deal.post}/hold`;
    const { orderId } = (await json(await deal.maya.send("POST", hold))) as { orderId: string };
    world.paypal.brandApproves(orderId);
    world.paypal.next("authorizeOrder", "pending");
    await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } });
    expect((await brandDeal(deal.maya, deal.deal.id)).posts[0]!.cancel).toEqual({ allowed: true, holdAttemptWaiting: true });

    expect((await fromDealPage(deal.maya, deal.deal.id, deal.post)).status).toBe(200);

    expect(await world.money.view(deal.post)).toMatchObject({ stage: "closed_not_held", closed: { because: "cancelled", by: "brand" } });
  });

  test("the same two routes cancel a held post too, through the money path", async () => {
    const world = heldWorld();
    const deal = await world.heldPost(TWO);

    expect((await fromInvite(deal.sam, deal.deal.id, deal.posts[0]!)).status).toBe(200);
    expect((await fromDealPage(deal.maya, deal.deal.id, deal.posts[1]!)).status).toBe(200);

    expect(released(world)).toBe(2);
    expect((await invite(deal.sam, deal.deal.id)).posts.map((post) => post.cancelled?.by)).toEqual(["creator", "brand"]);
  });
});

describe("PT-FR-30 before the brand has agreed, a post has no money: it is closed in the deal's own record", () => {
  test("the creator cancels one of two posts: no money is opened for it, either side sees it cancelled, and the brand agrees to the other alone", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ ...TWO, agreed: false });
    const [gone, kept] = waiting.posts as [string, string];

    const response = await fromInvite(waiting.sam, waiting.deal.id, gone, "Dropping the Short.");

    expect(response.status).toBe(200);
    expect(await world.money.view(gone)).toBeUndefined();
    expect((await brandDeal(waiting.maya, waiting.deal.id)).posts.map((post) => post.cancelled?.by)).toEqual(["creator", undefined]);

    expect((await waiting.maya.send("POST", `/brand/deals/${waiting.deal.id}/agree`, { body: { version: 1 } })).status).toBe(200);
    expect(await world.money.view(gone)).toBeUndefined();
    expect(await world.money.view(kept)).toMatchObject({ stage: "not_held" });
    expect((await waiting.maya.send("POST", `/brand/deals/${waiting.deal.id}/posts/${gone}/hold`)).status).toBe(409);
  });

  test("the brand cancels before agreeing, and the creator sees it with the brand's note", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ agreed: false });

    expect((await fromDealPage(waiting.maya, waiting.deal.id, waiting.post, "We went another way.")).status).toBe(200);

    expect((await invite(waiting.sam, waiting.deal.id)).posts[0]!.cancelled).toEqual({ by: "brand", at: expect.any(String), note: "We went another way." });
    expect(await prisma.deliverableMoney.count()).toBe(0);
  });

  test("a deal whose posts are all cancelled cannot be agreed", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ agreed: false });
    await fromInvite(waiting.sam, waiting.deal.id, waiting.post);

    const response = await waiting.maya.send("POST", `/brand/deals/${waiting.deal.id}/agree`, { body: { version: 1 } });

    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: { code: "cancelled" } });
    expect(await prisma.deliverableMoney.count()).toBe(0);
  });
});

describe("PT-FR-32 the deals list shows cancelled posts, and a deal whose posts are all cancelled", () => {
  test("a deal with one post cancelled follows the post that is left; with every post cancelled it reads Cancelled", async () => {
    const world = heldWorld();
    const deal = await world.heldPost(TWO);
    await fromInvite(deal.sam, deal.deal.id, deal.posts[0]!);

    expect((await deals(deal.sam))[0]).toMatchObject({ status: "Waiting for your draft", deliverables: [{ state: "released" }, { state: "no_draft" }] });

    await fromInvite(deal.sam, deal.deal.id, deal.posts[1]!);
    expect((await deals(deal.sam))[0]).toMatchObject({ status: "Cancelled", deliverables: [{ state: "released" }, { state: "released" }] });
  });

  test("a post cancelled before it was held reads as closed, and a deal cancelled before the brand agreed reads Cancelled", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ ...TWO, agreed: false });
    await fromInvite(waiting.sam, waiting.deal.id, waiting.posts[0]!);
    expect((await deals(waiting.sam))[0]).toMatchObject({ status: "Waiting for brand", deliverables: [{ state: "closed" }, { state: "no_draft" }] });

    await fromDealPage(waiting.maya, waiting.deal.id, waiting.posts[1]!);
    expect((await deals(waiting.sam))[0]).toMatchObject({ status: "Cancelled", deliverables: [{ state: "closed" }, { state: "closed" }] });
  });

  test("a held deal with a post closed before its hold counts only the posts that are left", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ ...TWO, held: false });
    await fromDealPage(deal.maya, deal.deal.id, deal.posts[0]!);

    expect((await deals(deal.sam))[0]).toMatchObject({ status: "Agreed · 0 of 1 held", deliverables: [{ state: "closed" }, { state: "no_draft" }] });
  });
});

describe("PT-FR-33 a deal with nothing left: its links stop working, with the one answer a dead link gives", () => {
  const open = (world: HeldWorld, url: string) => world.visitor().send("POST", `/b/${url.split("/b/")[1]}/session`);

  test("once every post is closed or released the invite link opens nothing, but a brand already in still sees the deal, cancelled", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ ...TWO, held: false });
    const { link } = await invite(deal.sam, deal.deal.id);
    await fromInvite(deal.sam, deal.deal.id, deal.posts[0]!);
    expect((await open(world, link!.url)).status).toBe(200);

    await fromInvite(deal.sam, deal.deal.id, deal.posts[1]!);

    const dead = await open(world, link!.url);
    expect(dead.status).toBe(404);
    expect(await json(dead)).toEqual({ error: { code: "link_not_working" } });
    expect((await brandDeal(deal.maya, deal.deal.id)).posts.map((post) => post.cancelled?.by)).toEqual(["creator", "creator"]);
  });

  test("a deal cancelled before the brand agreed: its link stops working too", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ agreed: false });
    const { link } = await invite(waiting.sam, waiting.deal.id);

    await fromInvite(waiting.sam, waiting.deal.id, waiting.post);

    expect((await open(world, link!.url)).status).toBe(404);
  });

  test("a deal whose only post was released at its deadline: its link stops working, though nobody cancelled", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();
    const { link } = await invite(deal.sam, deal.deal.id);
    const { deadlineAt } = (await world.money.view(deal.post))!.hold as { deadlineAt: Date };

    // The first link has long run out by the deadline, so the creator makes a new one the day before.
    world.timeIs("2026-10-16T09:00:00Z");
    expect((await deal.sam.send("GET", "/deals")).status).toBe(200);
    world.timeIs(new Date(deadlineAt.getTime() - 60_000).toISOString());
    expect((await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/link/renew`)).status).toBe(200);
    const fresh = (await invite(deal.sam, deal.deal.id)).link!;
    expect(fresh.url).not.toBe(link!.url);
    expect((await open(world, fresh.url)).status).toBe(200);
    world.timeIs(deadlineAt.toISOString());
    await world.runJobs();

    expect(await world.money.view(deal.post)).toMatchObject({ stage: "released" });
    expect((await open(world, fresh.url)).status).toBe(404);
  });
});
