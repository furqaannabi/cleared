/**
 * Disconnecting an account, through the app (account and history spec AH-FR-10 to AH-FR-14): the
 * stored access and the connected account are deleted, unless a post on that platform is under way,
 * and Google is then asked once to revoke what it gave.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { postedPublic } from "../test/live-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

type Profile = { accounts: { platform: string; name: string; inUse: boolean }[] };
const disconnect = (browser: Browser, platform: string) => browser.send("DELETE", `/connect/${platform}`);
const profile = async (browser: Browser) => (await (await browser.send("GET", "/me")).json()) as Profile;
const connected = async (name = "Sam Rivera") => (await prisma.connectedAccount.findMany({ where: { creator: { name } }, orderBy: { platform: "asc" } })).map((account) => account.platform);
async function later(world: HeldWorld, minutes = 5) {
  world.timeIs(new Date(world.now().getTime() + minutes * 60_000).toISOString());
  await world.runJobs();
}

describe("AH-FR-10 DELETE /connect/{platform}", () => {
  test("YouTube: the connection and its stored access are deleted, and the answer is the profile without it", async () => {
    const world = heldWorld();
    const sam = await world.creator();

    const response = await disconnect(sam, "youtube");

    expect(response.status).toBe(200);
    expect(((await response.json()) as Profile).accounts).toEqual([{ platform: "instagram", name: "sam", inUse: false }]);
    expect(await connected()).toEqual(["instagram"]);
  });

  test("Instagram: the same, and nothing is asked of Google or written to Instagram", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    world.instagram.reads.length = 0;

    const response = await disconnect(sam, "instagram");

    expect(response.status).toBe(200);
    expect(((await response.json()) as Profile).accounts.map((account) => account.platform)).toEqual(["youtube"]);
    expect(await connected()).toEqual(["youtube"]);
    expect(world.google.revoked).toEqual([]);
    expect(world.instagram.reads).toEqual([]);
  });

  test("an account that is not connected answers the profile as it is", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    await disconnect(sam, "youtube");
    world.google.revoked.length = 0;

    const again = await disconnect(sam, "youtube");

    expect(again.status).toBe(200);
    expect(((await again.json()) as Profile).accounts.map((account) => account.platform)).toEqual(["instagram"]);
    expect(world.google.revoked).toEqual([]);
  });

  test("AH-BR-04 only a signed-in creator, only their own connection, and only a platform there is", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    const ada = await world.creator("Ada Okafor");
    const deal = await world.agreedDeal(ada, { held: false });

    expect((await disconnect(world.visitor(), "youtube")).status).toBe(401);
    expect((await disconnect(deal.maya, "youtube")).status).toBe(401);
    expect((await disconnect(sam, "tiktok")).status).toBe(400);
    expect((await disconnect(sam, "youtube")).status).toBe(200);

    expect(await connected("Ada Okafor")).toEqual(["instagram", "youtube"]);
  });
});

describe("AH-FR-11, AH-FR-12 refused while a post on that platform is under way", () => {
  test("a held YouTube post stops YouTube being disconnected, and is named; Instagram, with no Reel under way, can still go", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });
    expect((await profile(deal.sam)).accounts).toEqual([
      { platform: "youtube", name: "Sam Rivera", inUse: true },
      { platform: "instagram", name: "sam", inUse: false },
    ]);

    const response = await disconnect(deal.sam, "youtube");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "post_under_way",
        blocking: [
          { dealId: deal.deal.id, deliverableId: deal.posts[0]!, brandName: "Glow Skincare", platform: "youtube_video" },
          { dealId: deal.deal.id, deliverableId: deal.posts[1]!, brandName: "Glow Skincare", platform: "youtube_short" },
        ],
      },
    });
    expect(await connected()).toEqual(["instagram", "youtube"]);
    expect(world.google.revoked).toEqual([]);
    expect((await disconnect(deal.sam, "instagram")).status).toBe(200);
  });

  test("a held Reel stops Instagram being disconnected, and not YouTube", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ platforms: ["instagram_reel"] });

    const response = await disconnect(deal.sam, "instagram");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "post_under_way", blocking: [{ deliverableId: deal.post, platform: "instagram_reel" }] } });
    expect((await disconnect(deal.sam, "youtube")).status).toBe(200);
  });

  test("a hold that was taken and is not yet paid still counts; once paid, the account can go", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();
    expect(await world.money.view(post.post)).toMatchObject({ stage: "captured" });
    expect((await disconnect(post.sam, "youtube")).status).toBe(409);

    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
    await later(world);

    expect(await world.money.view(post.post)).toMatchObject({ stage: "paid" });
    expect((await profile(post.sam)).accounts.find((account) => account.platform === "youtube")).toMatchObject({ inUse: false });
    expect((await disconnect(post.sam, "youtube")).status).toBe(200);
  });

  test("a post that was released no longer counts", async () => {
    const world = heldWorld();
    const deal = await world.heldPost();
    expect((await deal.sam.send("POST", `/deliverables/${deal.post}/cancel`, { body: {} })).status).toBe(200);

    expect((await disconnect(deal.sam, "youtube")).status).toBe(200);
  });

  test("AH-FR-14 a post that is agreed and not yet held is not in the way, and is not touched", async () => {
    const world = heldWorld();
    const deal = await world.heldPost({ held: false });

    expect((await disconnect(deal.sam, "youtube")).status).toBe(200);

    expect(await world.money.view(deal.post)).toMatchObject({ stage: "not_held" });
    expect(await prisma.deliverable.count({ where: { id: deal.post } })).toBe(1);
  });
});

describe("AH-FR-13 withdrawn at Google", () => {
  test("once the stored access is deleted, Google is asked once to revoke it", async () => {
    const world = heldWorld();
    const sam = await world.creator();
    /** What Sponing still held at the moment Google was asked. */
    let heldThen: string[] | undefined;
    world.google.onRevoke = async () => void (heldThen = await connected());

    await disconnect(sam, "youtube");

    expect(world.google.revoked).toEqual(["refresh-sam"]);
    // AH-BR-06: deleted first, so a failure at Google can never keep it.
    expect(heldThen).toEqual(["instagram"]);
  });

  test.each([
    ["answers no", (world: HeldWorld) => void (world.google.revokeFails = "refused")],
    ["cannot be reached", (world: HeldWorld) => void (world.google.revokeFails = "unreachable")],
  ])("when Google %s, the disconnect has still happened", async (_what, breaks) => {
    const world = heldWorld();
    const sam = await world.creator();
    breaks(world);

    const response = await disconnect(sam, "youtube");

    expect(response.status).toBe(200);
    expect(await connected()).toEqual(["instagram"]);
  });

  test("AH-BR-06 the token is in no answer and no log", async () => {
    const world = heldWorld();
    const sam = await world.creator();

    const response = await disconnect(sam, "youtube");

    expect(await response.text()).not.toContain("refresh-sam");
    expect(JSON.stringify(world.logged)).not.toContain("refresh-sam");
  });
});
