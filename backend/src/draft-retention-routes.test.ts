/**
 * How long drafts are kept, through the app (account and history spec AH-FR-23): a daily job deletes a
 * post's drafts, and everything read from them, 30 days after the post ends. The check's results stay.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { postedPublic } from "../test/live-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const DAY = 24 * 3600 * 1000;
const file = { bytes: new Uint8Array(2_000).fill(7) };
const filesOf = (world: HeldWorld, post: string) => [...world.storage.files.keys()].filter((key) => key.startsWith(`drafts/${post}/`));
/** Moves the clock on by days, the daily job running as it would. */
async function days(world: HeldWorld, count: number) {
  for (let day = 0; day < count; day++) {
    world.timeIs(new Date(world.now().getTime() + DAY).toISOString());
    await world.runJobs();
  }
}
/** A post paid at noon on 9 October, with its approved draft and what was said in it still kept. */
async function paidPost(world: HeldWorld) {
  await world.scheduleDraftExpiry();
  const post = await postedPublic(world);
  await world.runJobs();
  world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
  world.timeIs("2026-10-09T12:05:00Z");
  await world.runJobs();
  expect(await world.money.view(post.post)).toMatchObject({ stage: "paid" });
  expect(filesOf(world, post.post).length).toBeGreaterThan(1);
  return post;
}

describe("AH-FR-23 drafts are deleted 30 days after the post ends", () => {
  test("29 days after it was paid the draft is still there; a day later the file, what was said in it, and its row are gone", async () => {
    const world = heldWorld();
    const post = await paidPost(world);

    await days(world, 29);
    expect(filesOf(world, post.post).length).toBeGreaterThan(1);
    expect(await prisma.draft.count()).toBe(1);

    await days(world, 1);
    expect(filesOf(world, post.post)).toEqual([]);
    expect(await prisma.draft.count()).toBe(0);
  });

  test("the check's results stay with the deal, and the creator's post still reads, without a draft to play", async () => {
    const world = heldWorld();
    const post = await paidPost(world);
    const before = { check: await prisma.checkItem.count(), live: await prisma.liveCheckItem.count() };

    await days(world, 31);

    expect({ check: await prisma.checkItem.count(), live: await prisma.liveCheckItem.count() }).toEqual(before);
    // A month on, their session has run out: they sign in again.
    const read = await (await world.creator()).send("GET", `/deliverables/${post.post}`);
    expect(read.status).toBe(200);
    const seen = (await read.json()) as { state: string; items: unknown[]; draft?: unknown };
    expect(seen).toMatchObject({ state: "paid" });
    expect(seen.items.length).toBeGreaterThan(0);
    expect(seen.draft).toBeUndefined();
  });

  test("a released post's drafts go 30 days after the hold was given back", async () => {
    const world = heldWorld();
    await world.scheduleDraftExpiry();
    const deal = await world.heldPost();
    await deal.sam.send("POST", `/deliverables/${deal.post}/draft?fileName=glow.mp4`, { file });
    await world.finishChecks();
    expect((await deal.sam.send("POST", `/deliverables/${deal.post}/cancel`, { body: {} })).status).toBe(200);
    expect(await world.money.view(deal.post)).toMatchObject({ stage: "released" });

    await days(world, 29);
    expect(await prisma.draft.count()).toBe(1);
    await days(world, 2);

    expect(await prisma.draft.count()).toBe(0);
    expect(filesOf(world, deal.post)).toEqual([]);
  });

  test("a post that is still under way is never touched, however old its draft", async () => {
    const world = heldWorld({ drafts: {} });
    await world.scheduleDraftExpiry();
    const deal = await world.heldPost();
    await deal.sam.send("POST", `/deliverables/${deal.post}/draft?fileName=glow.mp4`, { file });
    await world.finishChecks();

    // Up to the day before its deadline: held throughout.
    await days(world, 13);

    expect(await world.money.view(deal.post)).toMatchObject({ stage: "held" });
    expect(await prisma.draft.count()).toBe(1);
    expect(filesOf(world, deal.post).length).toBeGreaterThan(0);
  });

  test("another post's drafts are not touched when one post's go", async () => {
    const world = heldWorld();
    const post = await paidPost(world);
    const other = await world.agreedDeal(await world.creator("Ada Okafor"));
    await other.sam.send("POST", `/deliverables/${other.post}/draft?fileName=ada.mp4`, { file });
    await world.finishChecks();
    const adas = filesOf(world, other.post);
    expect(adas.length).toBeGreaterThan(0);

    // Sam's post was paid 31 days ago by the end. Ada's was released at its deadline, well under 30 days ago.
    await days(world, 31);

    expect(filesOf(world, post.post)).toEqual([]);
    expect(filesOf(world, other.post)).toEqual(adas);
  });

  test("the job comes back every day, and asking for it twice makes one", async () => {
    const world = heldWorld();
    await world.scheduleDraftExpiry();
    await world.scheduleDraftExpiry();
    const waiting = () => prisma.job.count({ where: { name: "drafts_expire", status: "pending" } });
    expect(await waiting()).toBe(1);

    await days(world, 3);

    expect(await waiting()).toBe(1);
    expect(await prisma.job.count({ where: { name: "drafts_expire", OR: [{ status: "failed" }, { failures: { gt: 0 } }] } })).toBe(0);
  });
});
