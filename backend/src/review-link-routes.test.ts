/**
 * The brand's link to a review, when the brand first opened a draft, and each post's review on the
 * brand's deal, through the app (draft check and review spec DR-FR-44 to DR-FR-46, DR-FR-49).
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const video = { bytes: new Uint8Array(2_000).fill(7) };
const sendDraft = (browser: Browser, post: string) => browser.send("POST", `/deliverables/${post}/draft?fileName=glow-draft.mp4`, { file: video });
const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");

interface Link {
  url: string;
  expiresAt: string;
  expired: boolean;
}
interface Post {
  state: string;
  reviewLink?: Link;
  reviewOpenedAt?: string;
  [field: string]: unknown;
}

/** A held post whose draft has been checked. With `code: "unsure"` the draft is not fully passing. */
async function checked(world: HeldWorld, found: { code?: "unsure"; serum?: "unsure"; platforms?: string[] } = {}) {
  const held = await world.heldPost({ platforms: found.platforms });
  if (found.code === "unsure") world.speech.speech = [{ text: "Use code GLOW2O at checkout.", startSec: 5, endSec: 8 }];
  if (found.serum === "unsure") world.judge.visible = "cannot_tell";
  await sendDraft(held.sam, held.post);
  await world.finishChecks();
  const item = (name: string) => held.deal.items.find((each) => each.name === name && each.deliverableId === held.post)!.id;
  const brand = `/brand/deals/${held.deal.id}/deliverables/${held.post}`;
  return {
    ...held,
    code: item("Say the code GLOW20"),
    serum: item("Show the serum in use"),
    brand,
    readPost: async () => (await (await held.sam.send("GET", `/deliverables/${held.post}`)).json()) as Post,
    ask: (itemId: string) => held.sam.send("POST", `/deliverables/${held.post}/items/${itemId}/ask`),
    newLink: (browser = held.sam) => browser.send("POST", `/deliverables/${held.post}/review-link`),
  };
}

const tokenOf = (link: Link) => link.url.split("/b/")[1]!;
const open = (browser: Browser, link: Link | string) => browser.send("POST", `/b/${typeof link === "string" ? link : tokenOf(link)}/session`);

describe("DR-FR-44 a review link", () => {
  test("is made when the review window opens, lands on that post, and expires in 7 days", async () => {
    const world = heldWorld();
    const post = await checked(world);

    const link = (await post.readPost()).reviewLink!;

    expect(link).toEqual({
      url: expect.stringMatching(/^https:\/\/app\.cleared\.test\/b\/[A-Za-z0-9_-]{43}$/),
      expiresAt: new Date(world.now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      expired: false,
    });
    const visitor = world.visitor();
    const swapped = await open(visitor, link);
    expect(swapped.status).toBe(200);
    expect(await swapped.json()).toEqual({ dealId: post.deal.id, deliverableId: post.post });
    // The session is for the deal, as the invite link's was: it reads the post's review and the deal.
    expect((await visitor.send("GET", post.brand)).status).toBe(200);
    expect((await visitor.send("GET", `/brand/deals/${post.deal.id}`)).status).toBe(200);
  });

  test("is made by the first ask of a run, and a second ask does not change it", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure", serum: "unsure" });
    expect(await post.readPost()).not.toHaveProperty("reviewLink");

    expect((await post.ask(post.code)).status).toBe(200);
    const first = (await post.readPost()).reviewLink!;
    expect((await post.ask(post.serum)).status).toBe(200);

    expect(first.expired).toBe(false);
    expect((await post.readPost()).reviewLink).toEqual(first);
    expect(await prisma.inviteLink.count({ where: { deliverableId: post.post } })).toBe(1);
  });

  test("only a hash of its token is kept, and several people can each open it", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const link = (await post.readPost()).reviewLink!;

    const rows = await prisma.inviteLink.findMany({ where: { deliverableId: post.post } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(sha256(tokenOf(link)));
    expect(JSON.stringify(rows)).not.toContain(tokenOf(link));

    const colleague = world.visitor();
    expect((await open(world.visitor(), link)).status).toBe(200);
    expect((await open(colleague, link)).status).toBe(200);
    expect((await colleague.send("GET", post.brand)).status).toBe(200);
  });

  test("the deal's own invite link still lands on the deal, with no post named", async () => {
    const world = heldWorld();
    const { sam, deal } = await world.heldPost();
    const invite = ((await (await sam.send("GET", `/deals/${deal.id}/invite`)).json()) as { link: Link }).link;

    expect(await (await open(world.visitor(), invite)).json()).toEqual({ dealId: deal.id });
  });

  test("it is for the creator alone: the brand's own views never carry it", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const token = tokenOf((await post.readPost()).reviewLink!);

    expect(await (await post.maya.send("GET", post.brand)).text()).not.toContain(token);
    expect(await (await post.maya.send("GET", `/brand/deals/${post.deal.id}`)).text()).not.toContain(token);
  });
});

describe("DR-FR-45 a review link stops working when the brand has nothing left to do", () => {
  const dead = { status: 404, body: JSON.stringify({ error: { code: "link_not_working" } }) };
  const tried = async (world: HeldWorld, link: Link) => {
    const response = await open(world.visitor(), link);
    return { status: response.status, body: await response.text() };
  };

  test("once the draft is approved it opens nothing new, with the same answer as a link that never existed; someone already in still sees the approval", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const link = (await post.readPost()).reviewLink!;
    const colleague = world.visitor();
    await open(colleague, link);

    await post.maya.send("POST", `${post.brand}/approve`);

    expect(await tried(world, link)).toEqual(dead);
    expect(await tried(world, { ...link, url: "https://app.cleared.test/b/never-a-link" })).toEqual(dead);
    expect(await post.readPost()).not.toHaveProperty("reviewLink");
    expect(await (await colleague.send("GET", post.brand)).json()).toMatchObject({ review: { state: "approved" } });
  });

  test("a new draft ends it, and the next ask or window makes a new one", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const first = (await post.readPost()).reviewLink!;

    await sendDraft(post.sam, post.post);
    expect(await tried(world, first)).toEqual(dead);
    expect(await post.readPost()).not.toHaveProperty("reviewLink");

    await world.finishChecks();
    const second = (await post.readPost()).reviewLink!;
    expect(second.url).not.toBe(first.url);
    expect((await open(world.visitor(), second)).status).toBe(200);
    expect(await tried(world, first)).toEqual(dead);
  });

  test("a released hold ends it", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const link = (await post.readPost()).reviewLink!;

    await world.money.cancel(post.post, "creator");

    expect(await tried(world, link)).toEqual(dead);
    expect(await post.readPost()).not.toHaveProperty("reviewLink");
  });

  test("after 7 days it has expired, and the creator's post says so while the brand still has something to do", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure" });
    await post.ask(post.code);
    const link = (await post.readPost()).reviewLink!;

    world.timeIs(link.expiresAt);

    expect(await tried(world, link)).toEqual(dead);
    expect((await post.readPost()).reviewLink).toEqual({ ...link, expired: true });
  });
});

describe("DR-FR-45 the creator makes a new review link", () => {
  test("after one has expired, while the brand still has something to do: the new one works and the old one does not", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure" });
    await post.ask(post.code);
    const old = (await post.readPost()).reviewLink!;
    world.timeIs(old.expiresAt);

    const response = await post.newLink();

    expect(response.status).toBe(200);
    const fresh = ((await response.json()) as Post).reviewLink!;
    expect(fresh.url).not.toBe(old.url);
    expect(fresh).toMatchObject({ expired: false, expiresAt: new Date(new Date(old.expiresAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() });
    expect((await open(world.visitor(), fresh)).status).toBe(200);
    expect((await open(world.visitor(), old)).status).toBe(404);
  });

  test("a link sent to the wrong person can be replaced while it still works, which ends the sessions made from it", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const old = (await post.readPost()).reviewLink!;
    const stranger = world.visitor();
    await open(stranger, old);
    expect((await stranger.send("GET", post.brand)).status).toBe(200);

    const fresh = ((await (await post.newLink()).json()) as Post).reviewLink!;

    expect((await stranger.send("GET", post.brand)).status).toBe(401);
    expect((await open(world.visitor(), old)).status).toBe(404);
    expect((await open(world.visitor(), fresh)).status).toBe(200);
    // The brand's first way in, the deal's invite link, is not touched.
    expect((await post.maya.send("GET", post.brand)).status).toBe(200);
  });

  test("there is none to make when the brand has nothing to do, and only the post's creator can make one", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure" });

    const none = await post.newLink();
    expect(none.status).toBe(409);
    expect(await none.json()).toEqual({ error: { code: "nothing_for_brand" } });

    await post.ask(post.code);
    expect((await post.newLink(await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await post.newLink(post.maya)).status).toBe(401);
    expect((await post.newLink(world.visitor())).status).toBe(401);
  });
});

describe("DR-FR-44, DS-FR-33 the two kinds of link do not disturb each other", () => {
  test("replacing the deal's invite link leaves a review link working, and its sessions too", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const review = (await post.readPost()).reviewLink!;
    const reviewer = world.visitor();
    await open(reviewer, review);

    expect((await post.sam.send("POST", `/deals/${post.deal.id}/invite/link/renew`)).status).toBe(200);

    expect((await reviewer.send("GET", post.brand)).status).toBe(200);
    expect((await open(world.visitor(), review)).status).toBe(200);
    // The invite link's own sessions end, as before.
    expect((await post.maya.send("GET", post.brand)).status).toBe(401);
  });

  test("the invite page shows the invite link, never a review link", async () => {
    const world = heldWorld();
    const post = await checked(world);
    const review = (await post.readPost()).reviewLink!;

    const invite = (await (await post.sam.send("GET", `/deals/${post.deal.id}/invite`)).json()) as { link: Link };

    expect(invite.link.url).not.toBe(review.url);
  });
});

describe("DR-FR-46 opened", () => {
  test("the first time a brand session reads a post's review is recorded, and the creator's post reports it", async () => {
    const world = heldWorld();
    const post = await checked(world);
    expect(await post.readPost()).not.toHaveProperty("reviewOpenedAt");

    world.timeIs("2026-10-09T18:30:00Z");
    await post.maya.send("GET", post.brand);
    world.timeIs("2026-10-10T07:00:00Z");
    await post.maya.send("GET", post.brand);

    expect((await post.readPost()).reviewOpenedAt).toBe("2026-10-09T18:30:00.000Z");
  });

  test("a read before the brand is shown any draft is not an opening", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure" });

    await post.maya.send("GET", post.brand);

    expect(await post.readPost()).not.toHaveProperty("reviewOpenedAt");
  });

  test("a new draft has not been opened yet", async () => {
    const world = heldWorld();
    const post = await checked(world);
    await post.maya.send("GET", post.brand);
    expect(await post.readPost()).toHaveProperty("reviewOpenedAt");

    await sendDraft(post.sam, post.post);
    await world.finishChecks();

    expect(await post.readPost()).not.toHaveProperty("reviewOpenedAt");
  });
});

describe("DR-FR-49 the brand's deal", () => {
  const reviews = async (browser: Browser, dealId: string) =>
    ((await (await browser.send("GET", `/brand/deals/${dealId}`)).json()) as { posts: { deliverableId: string; review?: unknown }[] }).posts.map((post) => post.review);

  test("each post says where its review stands and how many items wait on the brand or are objected to", async () => {
    const world = heldWorld();
    const post = await checked(world, { code: "unsure", platforms: ["youtube_video", "youtube_short"] });
    world.judge.visible = "yes";
    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "nothing_yet" }, { state: "nothing_yet" }]);

    await post.ask(post.code);
    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "asked", count: 1 }, { state: "nothing_yet" }]);

    world.timeIs("2026-10-10T08:00:00Z");
    await post.maya.send("POST", `${post.brand}/items/${post.code}/accept`);
    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "window", endsAt: "2026-10-12T08:00:00.000Z" }, { state: "nothing_yet" }]);

    await post.maya.send("POST", `${post.brand}/objections`, { body: { objections: [{ itemId: post.serum, note: "That's the old bottle." }] } });
    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "objected", count: 1 }, { state: "nothing_yet" }]);

    await post.maya.send("POST", `${post.brand}/approve`);
    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "approved" }, { state: "nothing_yet" }]);
  });

  test("a released post says so", async () => {
    const world = heldWorld();
    const post = await checked(world);
    await world.money.cancel(post.post, "creator");

    expect(await reviews(post.maya, post.deal.id)).toEqual([{ state: "released" }]);
  });

  test("a post that is not held yet has no review to report", async () => {
    const world = heldWorld();
    const { maya, deal } = await world.agreedDeal(await world.creator(), { held: false });

    expect(await reviews(maya, deal.id)).toEqual([undefined]);
  });
});
