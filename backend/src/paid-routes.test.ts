/**
 * What the creator sees from posting to paid, through the app (publish to paid spec PT-FR-24 to
 * PT-FR-27, PT-BR-09, PT-BR-13): the published post, the live check, the capture and the payout.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { VIDEO, postedPublic } from "../test/live-post";

beforeEach(resetDatabase);

type Item = { name: string; status: string; checkedBy: string; evidence?: Record<string, unknown>; fixHint?: string };
interface Post {
  state: string;
  items: Item[];
  hold: { stage: string };
  payoutEmail: string;
  post?: { url: string; publishedAt: string };
  liveCheck?: Record<string, unknown>;
  capture?: Record<string, unknown>;
  payout?: Record<string, unknown>;
  [field: string]: unknown;
}

const read = async (post: { sam: { send: (method: string, path: string) => Promise<Response> }; post: string }) => (await (await post.sam.send("GET", `/deliverables/${post.post}`)).json()) as Post;
const link = (post: Post) => post.items.find((item) => item.name === "Put the link in the description")!;

/** Time passes and the worker runs, so the money path hears what PayPal did. */
async function later(world: HeldWorld, minutes = 5) {
  world.timeIs(new Date(world.now().getTime() + minutes * 60_000).toISOString());
  await world.runJobs();
}

describe("PT-FR-24, PT-FR-25 the creator's post from posting to paid", () => {
  test("published and being checked: the post's link and time, and its live-check items read as checking", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);

    const seen = await read(post);

    expect(seen).toMatchObject({
      state: "published",
      post: { url: `https://www.youtube.com/watch?v=${VIDEO}`, publishedAt: "2026-10-09T12:00:00.000Z" },
      liveCheck: { state: "checking" },
    });
    expect(link(seen)).toMatchObject({ status: "checking", checkedBy: "published_post" });
    expect(seen.capture).toBeUndefined();
    expect(seen.payout).toBeUndefined();
  });

  test("passed and captured: each live-check item's result with evidence from the live post, the capture with its reference and exact amounts, and the payout on its way", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();

    const seen = await read(post);

    expect(seen).toMatchObject({ state: "captured", hold: { stage: "captured" }, liveCheck: { state: "passed" } });
    expect(link(seen)).toEqual(expect.objectContaining({ status: "passed", checkedBy: "published_post", evidence: { label: "Description", text: "https://glow.example/sam" } }));
    expect(seen.capture).toEqual({ reference: expect.any(String), at: expect.any(String), amount: "1200.00", fee: "60.00", payout: "1140.00" });
    expect(seen.payout).toEqual({ state: "sending", email: "sam.pay@example.com", canSendAgain: false });
  });

  test("paid: the payout's PayPal reference and when it arrived", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    await world.runJobs();
    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
    await later(world);

    const seen = await read(post);

    expect(seen).toMatchObject({ state: "paid", hold: { stage: "paid" } });
    expect(seen.payout).toEqual({ state: "paid", email: "sam.pay@example.com", reference: expect.any(String), at: expect.any(String), canSendAgain: false });
  });

  test("a fixable failure: the item says what to change, the post says until when, and nothing is captured", async () => {
    const world = heldWorld();
    const post = await postedPublic(world, { description: "My two weeks with Glow Serum." });
    await world.runJobs();

    const seen = await read(post);

    expect(seen).toMatchObject({ state: "published", hold: { stage: "confirmed" }, liveCheck: { state: "fixable", fixBy: expect.any(String) } });
    expect(link(seen)).toMatchObject({ status: "fix_needed", fixHint: 'Add "https://glow.example/sam" to the description, exactly as written.' });
    expect(seen.capture).toBeUndefined();
  });

  test("PT-FR-16 while a post is checked again, the last results stay and the post says a check is running", async () => {
    const world = heldWorld();
    const post = await postedPublic(world, { description: "My two weeks with Glow Serum." });
    await world.runJobs();

    const seen = (await (await post.again()).json()) as Post;

    expect(seen.liveCheck).toMatchObject({ state: "fixable", checking: true });
    expect(link(seen)).toMatchObject({ status: "fix_needed" });
  });

  test("PT-FR-17 a check that stopped on lost access says to reconnect YouTube, and shows no result", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    world.youtube.lostAccess.add("refresh-sam");
    await world.runJobs();

    const seen = await read(post);

    expect(seen).toMatchObject({ state: "published", liveCheck: { state: "reconnect_youtube" } });
    expect(link(seen)).toMatchObject({ status: "at_live_check" });
  });

  test("undecided: what could not be checked, and until when the brand can confirm", async () => {
    const world = heldWorld();
    const post = await postedPublic(world, { fileSizeBytes: undefined, durationSec: undefined });
    await world.runJobs();

    expect((await read(post)).liveCheck).toEqual({ state: "undecided", what: ["file_record"], brandBy: expect.any(String) });
  });

  test("a capture PayPal refuses: approved, with until when it is tried again", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    world.paypal.next("captureHold", "refused");
    await world.runJobs();

    const seen = await read(post);

    expect(seen).toMatchObject({ state: "published", liveCheck: { state: "passed" }, capture: { refused: true, retryUntil: expect.any(String) } });
    expect(seen.payout).toBeUndefined();
  });
});

describe("PT-FR-25 the deals list carries the states past approved", () => {
  type Listed = { status: string; openDeliverableId?: string; deliverables: { id: string; state: string }[] };
  const listed = async (post: { sam: { send: (method: string, path: string) => Promise<Response> } }) => ((await (await post.sam.send("GET", "/deals")).json()) as Listed[])[0]!;

  test("published and being checked, then captured, then paid", async () => {
    const world = heldWorld();
    const post = await postedPublic(world);
    expect(await listed(post)).toMatchObject({ status: "Live check", deliverables: [{ id: post.post, state: "published" }] });

    await world.runJobs();
    expect(await listed(post)).toMatchObject({ status: "Captured", deliverables: [{ state: "captured" }] });

    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
    await later(world);
    expect(await listed(post)).toMatchObject({ status: "Paid", deliverables: [{ state: "paid" }] });
  });

  test("a live post to fix, and a payout the creator has to act on, are the creator's next step", async () => {
    const world = heldWorld();
    const fixing = await postedPublic(world, { description: "My two weeks with Glow Serum." });
    await world.runJobs();
    expect(await listed(fixing)).toMatchObject({ status: "Fix your live post", openDeliverableId: fixing.post, deliverables: [{ state: "published" }] });

    await resetDatabase();
    const other = heldWorld();
    const unclaimed = await postedPublic(other);
    await other.runJobs();
    other.paypal.payoutEnds(other.paypal.payouts()[0]!.payoutReference, "unclaimed");
    await later(other);
    expect(await listed(unclaimed)).toMatchObject({ status: "Payout needs you", openDeliverableId: unclaimed.post, deliverables: [{ state: "captured" }] });
  });
});

/** A post that passed its live check and was captured: its first payout is with PayPal. */
async function capturedPost(world: HeldWorld) {
  const post = await postedPublic(world);
  await world.runJobs();
  const first = world.paypal.payouts()[0]!;
  return {
    ...post,
    /** PayPal reports how the latest payout ended, and the money path hears of it. */
    payoutEnds: async (result: Parameters<HeldWorld["paypal"]["payoutEnds"]>[1]) => {
      world.paypal.payoutEnds(world.paypal.payouts().at(-1)!.payoutReference, result);
      await later(world);
    },
    first,
    sendAgain: (browser = post.sam) => browser.send("POST", `/deliverables/${post.post}/payout/again`),
    saveEmail: (email: string, browser = post.sam) => browser.send("PUT", "/me/paypal-email", { body: { email } }),
  };
}

describe("PT-FR-26 send it again", () => {
  test("a payout that failed is sent again as a new payout, to the creator's PayPal email as it now stands", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.payoutEnds("failed");
    expect((await read(post)).payout).toMatchObject({ state: "failed", reason: "failed", canSendAgain: true });
    expect((await post.saveEmail("sam.right@example.com")).status).toBe(200);

    const response = await post.sendAgain();

    expect(response.status).toBe(200);
    expect(((await response.json()) as Post).payout).toMatchObject({ state: "sending", email: "sam.right@example.com", canSendAgain: false });
    expect(world.paypal.payouts().map((payout) => payout.email)).toEqual(["sam.pay@example.com", "sam.right@example.com"]);
    expect(world.paypal.payouts()[1]!.amountCents).toBe(114_000);
  });

  test("an unclaimed payout is cancelled first, and the new one goes to the email saved since", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.payoutEnds("unclaimed");
    await post.saveEmail("sam.right@example.com");
    // The unclaimed payout is still with PayPal, for the address it was sent to.
    expect((await read(post)).payout).toMatchObject({ state: "unclaimed", email: "sam.pay@example.com", canSendAgain: true });

    const response = await post.sendAgain();

    expect(response.status).toBe(200);
    // PayPal confirmed the cancellation at once here, so the new payout is already on its way.
    expect(world.paypal.calls.filter((call) => call.method === "cancelPayout")).toHaveLength(1);
    expect(((await response.json()) as Post).payout).toMatchObject({ state: "sending", email: "sam.right@example.com", canSendAgain: false });
    expect(world.paypal.payouts().map((payout) => payout.email)).toEqual(["sam.pay@example.com", "sam.right@example.com"]);
  });

  test("the money path decides whether it can be sent again: a payout still on its way is refused with its reason, and nothing is sent", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);

    const response = await post.sendAgain();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: expect.any(String) } });
    expect(world.paypal.payouts()).toHaveLength(1);
  });

  test("PT-BR-08 only the post's own creator can ask", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.payoutEnds("failed");

    expect((await post.sendAgain(await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await post.sendAgain(post.maya)).status).toBe(401);
    expect(world.paypal.payouts()).toHaveLength(1);
  });
});

describe("PT-FR-27 a new PayPal email reaches every post whose payout has not been sent to PayPal", () => {
  type Profile = { paypalEmail: string; postsKeepingEmail?: { deliverableId: string; dealId: string; brandName: string; email: string }[] };

  test("a post with no payout yet is paid at the new email, and the answer names no post", async () => {
    const world = heldWorld();
    const held = await world.heldPost();

    const response = await held.sam.send("PUT", "/me/paypal-email", { body: { email: "sam.new@example.com" } });

    expect(response.status).toBe(200);
    expect((await response.json()) as Profile).toMatchObject({ paypalEmail: "sam.new@example.com", postsKeepingEmail: [] });
    expect((await read(held)).payoutEmail).toBe("sam.new@example.com");
  });

  test("a payout already with PayPal keeps the email it went to, and the answer says which post that is", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);

    const profile = (await (await post.saveEmail("sam.new@example.com")).json()) as Profile;

    expect(profile.paypalEmail).toBe("sam.new@example.com");
    expect(profile.postsKeepingEmail).toEqual([{ deliverableId: post.post, dealId: post.deal.id, brandName: "Glow Skincare", email: "sam.pay@example.com" }]);
    expect((await read(post)).payout).toMatchObject({ state: "sending", email: "sam.pay@example.com" });
  });

  test("a payout that ended unpaid is not with PayPal any more: the new email replaces the old", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.payoutEnds("returned");

    const profile = (await (await post.saveEmail("sam.new@example.com")).json()) as Profile;

    expect(profile.postsKeepingEmail).toEqual([]);
    expect((await read(post)).payout).toMatchObject({ state: "failed", reason: "returned", email: "sam.new@example.com" });
  });

  test("a post that is paid, and another creator's posts, are left alone", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.payoutEnds("succeeded");
    const ada = await world.creator("Ada Okafor");
    const adas = await world.agreedDeal(ada);

    const profile = (await (await post.saveEmail("sam.new@example.com")).json()) as Profile;

    expect(profile.postsKeepingEmail).toEqual([]);
    expect((await read(post)).payout).toMatchObject({ state: "paid", email: "sam.pay@example.com" });
    expect((await read(adas)).payoutEmail).toBe("ada.pay@example.com");
  });

  test("PT-BR-09 the brand's view of the post never holds either email", async () => {
    const world = heldWorld();
    const post = await capturedPost(world);
    await post.saveEmail("sam.new@example.com");

    const seen = JSON.stringify(await (await post.maya.send("GET", `/brand/deals/${post.deal.id}/deliverables/${post.post}`)).json());

    expect(seen).not.toContain("sam.pay@example.com");
    expect(seen).not.toContain("sam.new@example.com");
  });
});
