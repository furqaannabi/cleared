/**
 * The creator's payment history, through the app (account and history spec AH-FR-05 to AH-FR-09):
 * one row for every post of theirs that has ever had a hold, with the money path's own amounts.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { postedPublic } from "../test/live-post";

beforeEach(resetDatabase);

type Row = Record<string, unknown> & { deliverableId: string; stage: string };
const payments = (browser: Browser) => browser.send("GET", "/me/payments");
const rows = async (browser: Browser) => (await (await payments(browser)).json()) as Row[];
const file = { bytes: new Uint8Array(2_000).fill(7) };
async function later(world: HeldWorld, minutes = 5) {
  world.timeIs(new Date(world.now().getTime() + minutes * 60_000).toISOString());
  await world.runJobs();
}

describe("AH-FR-05 GET /me/payments", () => {
  test("a held post is one row: the deal, the brand, the platform, the amount, and the hold with its reference, time and deadline", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();

    const response = await payments(deal.sam);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        dealId: deal.deal.id,
        deliverableId: deal.post,
        brandName: "Glow Skincare",
        platform: "youtube_video",
        amountMinor: 120_000,
        currency: "USD",
        stage: "held",
        holdReference: expect.any(String),
        heldAt: "2026-10-09T09:00:00.000Z",
        deadline: expect.stringMatching(/^2026-10-2\dT/),
      },
    ]);
  });

  test("a creator with nothing held has an empty history: a post agreed and not held, or closed without a hold, is not in it", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false, platforms: ["youtube_video", "youtube_short"] });
    expect(await rows(deal.sam)).toEqual([]);

    await deal.sam.send("POST", `/deals/${deal.deal.id}/invite/posts/${deal.post}/cancel`, { body: {} });

    expect(await rows(deal.sam)).toEqual([]);
  });

  test("the newest hold is first", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    const first = await world.agreedDeal(sam);
    world.timeIs("2026-10-09T15:00:00Z");
    const second = await world.agreedDeal(sam);

    expect((await rows(sam)).map((row) => row.deliverableId)).toEqual([second.post, first.post]);
  });

  test("AH-BR-04 only the signed-in creator's own posts, and nobody without a creator's session", async () => {
    const world = heldWorld();
    const sams = await world.heldPost();
    const adas = await world.agreedDeal(await world.creator("Ada Okafor"));

    expect((await rows(sams.sam)).map((row) => row.deliverableId)).toEqual([sams.post]);
    expect((await rows(adas.sam)).map((row) => row.deliverableId)).toEqual([adas.post]);
    expect((await payments(world.visitor())).status).toBe(401);
    // AH-BR-05: a brand's session is for its deal, and never reads a creator's history.
    expect((await payments(sams.maya)).status).toBe(401);
  });
});

describe("AH-FR-06 to AH-FR-08 a row follows the post to paid", () => {
  test("captured: the fee and what the creator receives are the money path's, and the payout is on its way", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();

    const [row] = await rows(post.sam);

    expect(row).toMatchObject({ stage: "captured", amountMinor: 120_000, feeMinor: 6_000, receivedMinor: 114_000, publishedAt: "2026-10-09T12:00:00.000Z", payout: { state: "sending" } });
    expect(row).not.toHaveProperty("paidAt");
  });

  test("paid: the payout's PayPal reference and when it was paid", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();
    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
    await later(world);

    const [row] = await rows(post.sam);
    const { paidAt, payout } = row as Row & { paidAt: string; payout: { at: string } };

    // It was paid when the payout was: one moment, said twice.
    expect(Date.parse(paidAt)).toBeGreaterThan(Date.parse("2026-10-09T12:00:00Z"));
    expect(paidAt).toBe(payout.at);
    expect(row).toMatchObject({ stage: "paid", receivedMinor: 114_000, payout: { state: "paid", reference: expect.any(String) } });
  });

  test("released: a held post that was cancelled keeps its row, with nothing received", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();
    expect((await deal.sam.send("POST", `/deliverables/${deal.post}/cancel`, { body: {} })).status).toBe(200);

    const [row] = await rows(deal.sam);

    expect(row).toMatchObject({ stage: "released", amountMinor: 120_000 });
    expect(row).not.toHaveProperty("receivedMinor");
  });

  test("AH-FR-08 the PayPal email is nowhere in the history", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();

    expect(await (await payments(post.sam)).text()).not.toContain("sam.pay@example.com");
  });
});

describe("AH-FR-09 passed first time", () => {
  test("absent until a check has finished; true when the first check passed every item", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();
    expect((await rows(deal.sam))[0]).not.toHaveProperty("firstCheckPassed");

    await deal.sam.send("POST", `/deliverables/${deal.post}/draft?fileName=glow.mp4`, { file });
    await world.finishChecks();

    expect((await rows(deal.sam))[0]).toMatchObject({ firstCheckPassed: true });
  });

  test("false when the first check found something to fix, and it stays false after a later draft passes", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();
    world.videoModel.verdict = "fix_needed";
    await deal.sam.send("POST", `/deliverables/${deal.post}/draft?fileName=glow.mp4`, { file });
    await world.finishChecks();
    expect((await rows(deal.sam))[0]).toMatchObject({ firstCheckPassed: false });

    world.videoModel.verdict = "passed";
    await deal.sam.send("POST", `/deliverables/${deal.post}/draft?fileName=glow-2.mp4`, { file });
    await world.finishChecks();

    expect(await (await deal.sam.send("GET", `/deliverables/${deal.post}`)).json()).toMatchObject({ state: "fully_passing", run: 2 });
    expect((await rows(deal.sam))[0]).toMatchObject({ firstCheckPassed: false });
  });
});
