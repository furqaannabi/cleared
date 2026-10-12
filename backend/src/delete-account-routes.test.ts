/**
 * Deleting the account, through the app (account and history spec AH-FR-15 to AH-FR-21): refused while
 * anything is open; otherwise what the creator made and said is deleted, and one anonymous record of
 * the money stays for each post that was ever held.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { postedPublic } from "../test/live-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const remove = (browser: Browser) => browser.send("DELETE", "/me");
const file = { bytes: new Uint8Array(2_000).fill(7) };
async function later(world: HeldWorld, minutes = 5) {
  world.timeIs(new Date(world.now().getTime() + minutes * 60_000).toISOString());
  await world.runJobs();
}
/** A deal that ran its whole course: checked, approved, posted, passed its live check, captured and paid. */
async function paidDeal(world: HeldWorld, deal: Parameters<typeof postedPublic>[2] = {}) {
  const post = await postedPublic(world, {}, deal);
  await world.runJobs();
  world.paypal.payoutEnds(world.paypal.payouts().at(-1)!.payoutReference, "succeeded");
  await later(world);
  expect(await world.money.view(post.post)).toMatchObject({ stage: "paid" });
  return post;
}
/** How many rows each table holds: everything a deal touches. */
async function counts() {
  const tables = ["creator", "session", "connectedAccount", "deal", "deliverable", "checklistItem", "question", "inviteLink", "termsVersion", "note", "draft", "draftCheck", "checkItem", "postVideo", "liveCheck", "liveCheckItem", "postCancel", "brandNotice", "deliverableMoney", "moneyRecord", "payPalCall"] as const;
  const found: Record<string, number> = {};
  for (const table of tables) found[table] = await (prisma[table] as unknown as { count: () => Promise<number> }).count();
  return found;
}
/** The money path's own rows for a post, as they stand. */
const moneyRows = async (deliverableId: string) => ({
  money: await prisma.deliverableMoney.findUnique({ where: { deliverableId }, select: { state: true, stage: true, amountCents: true, version: true } }),
  record: await prisma.moneyRecord.findMany({ where: { deliverableId }, orderBy: { id: "asc" } }),
  calls: await prisma.payPalCall.findMany({ where: { deliverableId }, orderBy: { startedAt: "asc" } }),
});

describe("AH-FR-16 refused while anything is open", () => {
  test.each([
    ["a post is held", async (world: HeldWorld) => world.heldPost(), "held"],
    [
      "a hold was taken and its payout is not settled",
      async (world: HeldWorld) => {
        const post = await postedPublic(world);
        await world.runJobs();
        return post;
      },
      "payout",
    ],
    ["the terms are with the brand", async (world: HeldWorld) => world.heldPost({ agreed: false }), "waiting_for_brand"],
    ["the brand agreed and a post is neither held nor closed", async (world: HeldWorld) => world.heldPost({ held: false }), "waiting_for_brand"],
  ] as const)("while %s, the answer names the deal and why, and nothing is deleted", async (_what, setUp, why) => {
    const world = heldWorld();
    const deal = await setUp(world);
    const before = await counts();

    const response = await remove(deal.sam);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "deal_open", blocking: [{ dealId: deal.deal.id, brandName: "Glow Skincare", why }] } });
    expect(await counts()).toEqual(before);
    expect((await deal.sam.send("GET", "/me")).status).toBe(200);
    expect(world.google.revoked).toEqual([]);
  });

  test("each deal in the way is listed once, with the first reason that applies: held before waiting on the brand", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    const finished = await world.agreedDeal(sam);
    await sam.send("POST", `/deliverables/${finished.post}/cancel`, { body: {} });
    // Deals are listed oldest first, so each is started a little after the last.
    world.timeIs("2026-10-09T10:00:00Z");
    const mixed = await world.agreedDeal(sam, { held: false, platforms: ["youtube_video", "youtube_short"] });
    const hold = `/brand/deals/${mixed.deal.id}/posts/${mixed.posts[0]}/hold`;
    const { orderId } = (await (await mixed.maya.send("POST", hold)).json()) as { orderId: string };
    world.paypal.brandApproves(orderId);
    await mixed.maya.send("POST", `${hold}/approved`, { body: { orderId } });
    world.timeIs("2026-10-09T11:00:00Z");
    const waiting = await world.agreedDeal(sam, { agreed: false });

    const response = await remove(sam);

    expect(((await response.json()) as { error: { blocking: unknown[] } }).error.blocking).toEqual([
      { dealId: mixed.deal.id, brandName: "Glow Skincare", why: "held" },
      { dealId: waiting.deal.id, brandName: "Glow Skincare", why: "waiting_for_brand" },
    ]);
  });

  test("AH-BR-04 nobody without a creator's session, and never a brand", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });

    expect((await remove(world.visitor())).status).toBe(401);
    expect((await remove(deal.maya)).status).toBe(401);
    expect(await prisma.creator.count()).toBe(1);
  });
});

describe("AH-FR-15, AH-FR-17 deleting", () => {
  test("a creator with nothing open is deleted: 204, the cookie is cleared, and every session of theirs has ended", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    const phone = await world.creator();

    const response = await remove(sam);

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/cleared_session=;/);
    expect((await phone.send("GET", "/me")).status).toBe(401);
    expect(await counts()).toMatchObject({ creator: 0, session: 0, connectedAccount: 0 });
  });

  test("a deal the brand was never invited to is never in the way, and goes with the account", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    await sam.send("POST", "/deals", { body: { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }] } });

    expect((await remove(sam)).status).toBe(204);

    expect(await counts()).toMatchObject({ creator: 0, deal: 0, deliverable: 0 });
  });

  test("a finished deal: everything the creator made and said is gone, and so is the brand's email and every link", async () => {
    const world = heldWorld();
    const post = await paidDeal(world, { brandEmail: "maya@glow.example", noticeEmail: "maya.notices@glow.example" });
    expect(await counts()).toMatchObject({ checklistItem: 3, termsVersion: 1, draft: 1, draftCheck: 1, checkItem: 3, postVideo: 1, liveCheck: 1, liveCheckItem: 1 });

    expect((await remove(post.sam)).status).toBe(204);

    expect(await counts()).toMatchObject({
      creator: 0,
      session: 0,
      connectedAccount: 0,
      checklistItem: 0,
      question: 0,
      inviteLink: 0,
      termsVersion: 0,
      note: 0,
      draft: 0,
      draftCheck: 0,
      checkItem: 0,
      postVideo: 0,
      liveCheck: 0,
      liveCheckItem: 0,
      postCancel: 0,
      brandNotice: 0,
    });
  });

  test("AH-FR-18, AH-BR-03 what is kept: the post's money records exactly as they were, with the deal's and post's ids, the brand's name and the platform", async () => {
    const world = heldWorld();
    const post = await paidDeal(world, { brandEmail: "maya@glow.example", noticeEmail: "maya.notices@glow.example" });
    const before = await moneyRows(post.post);
    expect(before.record.length).toBeGreaterThan(5);

    await remove(post.sam);

    // Amounts, dates, stages and PayPal references are untouched.
    expect(await moneyRows(post.post)).toEqual(before);
    expect(await prisma.deal.findMany()).toEqual([expect.objectContaining({ id: post.deal.id, brandName: "Glow Skincare", creatorId: null, briefLines: null, brandEmail: null, brandNoticeEmail: null, timezone: null })]);
    expect(await prisma.deliverable.findMany()).toEqual([expect.objectContaining({ id: post.post, dealId: post.deal.id, platform: "youtube_video" })]);
  });

  test("AH-FR-18 nothing kept points to a person: no name and no email is left in any table", async () => {
    const world = heldWorld();
    const post = await paidDeal(world, { brandEmail: "maya@glow.example", noticeEmail: "maya.notices@glow.example" });
    const everything = async () => JSON.stringify(await Promise.all([prisma.deal.findMany(), prisma.deliverable.findMany(), prisma.deliverableMoney.findMany(), prisma.moneyRecord.findMany(), prisma.payPalCall.findMany(), prisma.ruling.findMany(), prisma.job.findMany(), prisma.payPalEvent.findMany()]), (_key, value) => (typeof value === "bigint" ? String(value) : value));
    expect(await everything()).toContain("sam.pay@example.com");

    await remove(post.sam);

    const left = await everything();
    for (const never of ["sam.pay@example.com", "sam@example.com", "Sam Rivera", "maya@glow.example", "maya.notices@glow.example", "google-Sam Rivera", "GLOW20", "glow.example/sam"]) expect(left).not.toContain(never);
    expect(await prisma.deliverableMoney.findUnique({ where: { deliverableId: post.post }, select: { payoutEmail: true } })).toEqual({ payoutEmail: "" });
  });

  test("a held post that was released is kept; a post in the same deal that was never held is not, and nor are its money rows", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false, platforms: ["youtube_video", "youtube_short"] });
    const [video, short] = deal.posts as [string, string];
    const hold = `/brand/deals/${deal.deal.id}/posts/${video}/hold`;
    const { orderId } = (await (await deal.maya.send("POST", hold)).json()) as { orderId: string };
    world.paypal.brandApproves(orderId);
    await deal.maya.send("POST", `${hold}/approved`, { body: { orderId } });
    await deal.sam.send("POST", `/deliverables/${video}/cancel`, { body: { note: "Not this month." } });
    await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${short}/cancel`, { body: {} });
    await later(world);
    expect(await world.money.view(video)).toMatchObject({ stage: "released" });
    const before = await moneyRows(video);

    expect((await remove(deal.sam)).status).toBe(204);

    expect((await prisma.deliverable.findMany()).map((post) => post.id)).toEqual([video]);
    expect((await prisma.deliverableMoney.findMany()).map((row) => row.deliverableId)).toEqual([video]);
    expect(await prisma.moneyRecord.count({ where: { deliverableId: short } })).toBe(0);
    expect(await prisma.payPalCall.count({ where: { deliverableId: short } })).toBe(0);
    expect(await moneyRows(video)).toEqual(before);
  });

  test("a deal whose every post was cancelled before it was held leaves nothing at all", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });
    await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${deal.post}/cancel`, { body: {} });

    expect((await remove(deal.sam)).status).toBe(204);

    expect(await counts()).toMatchObject({ deal: 0, deliverable: 0, deliverableMoney: 0, moneyRecord: 0, payPalCall: 0 });
  });

  test("another creator's account, deals and money are not touched", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    const adas = await world.agreedDeal(await world.creator("Ada Okafor"));
    await adas.sam.send("POST", `/deliverables/${adas.post}/draft?fileName=ada.mp4`, { file });
    await world.finishChecks();
    const before = { rows: await moneyRows(adas.post), files: [...world.storage.files.keys()] };

    expect((await remove(sam)).status).toBe(204);
    await later(world);

    expect(await counts()).toMatchObject({ creator: 1, deal: 1, draft: 1, checkItem: 3 });
    expect(await moneyRows(adas.post)).toEqual(before.rows);
    expect([...world.storage.files.keys()]).toEqual(before.files);
    expect((await adas.sam.send("GET", `/deliverables/${adas.post}`)).status).toBe(200);
  });
});

describe("AH-FR-19 to AH-FR-21 afterwards", () => {
  test("the brand's link to the deal stops working, with the answer any dead link gets", async () => {
    const world = heldWorld();
    const post = await paidDeal(world);
    expect((await post.maya.send("GET", `/brand/deals/${post.deal.id}`)).status).toBe(200);

    await remove(post.sam);

    const response = await post.maya.send("GET", `/brand/deals/${post.deal.id}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "signed_out" } });
  });

  test("the files go by a job, soon after: nothing of the creator's is left in the bucket", async () => {
    const world = heldWorld();
    const post = await paidDeal(world);
    expect([...world.storage.files.keys()].some((key) => key.startsWith(`drafts/${post.post}/`))).toBe(true);

    await remove(post.sam);
    await later(world);

    expect([...world.storage.files.keys()]).toEqual([]);
  });

  test("Google is asked to revoke once the account is gone, and Google failing changes nothing", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    let creatorsThen: number | undefined;
    world.google.onRevoke = async () => void (creatorsThen = await prisma.creator.count());
    world.google.revokeFails = "unreachable";

    expect((await remove(sam)).status).toBe(204);

    expect(world.google.revoked).toEqual(["refresh-sam"]);
    expect(creatorsThen).toBe(0);
  });

  test("signing in again with the same Google account makes a new, empty account", async () => {
    const world = heldWorld();
    const post = await paidDeal(world);
    await remove(post.sam);

    const back = await world.creator();

    expect(await (await back.send("GET", "/deals")).json()).toEqual([]);
    expect(await (await back.send("GET", "/me/payments")).json()).toEqual([]);
    expect((await prisma.deal.findMany()).map((deal) => deal.creatorId)).toEqual([null]);
  });

  test("the timers left behind find nothing to do and fail at nothing", async () => {
    const world = heldWorld();
    const post = await paidDeal(world);
    await remove(post.sam);

    for (let day = 0; day < 40; day++) await later(world, 24 * 60);

    expect(await prisma.job.count({ where: { OR: [{ status: "failed" }, { failures: { gt: 0 } }] } })).toBe(0);
    expect(await moneyRows(post.post)).toMatchObject({ money: { stage: "paid" } });
  });
});
