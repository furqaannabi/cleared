/**
 * The brand after a post is published, through the app (publish to paid spec PT-FR-18 to PT-FR-23,
 * PT-BR-08 to PT-BR-12): its own email for notices, confirm, object and accept, the fresh link and
 * the email that carries it, and what the brand is shown of the money.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { VIDEO, goAheadGiven, notFixablePost, postedPublic, undecidedPost } from "../test/live-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

describe("PT-FR-22 the brand's own address for notices", () => {
  test("the brand can give an email when it agrees; it is kept for the deal and never shown to the creator", async () => {
    const world = heldWorld();
    const held = await world.heldPost({ noticeEmail: "maya@glow.example" });

    expect((await prisma.deal.findUniqueOrThrow({ where: { id: held.deal.id } })).brandNoticeEmail).toBe("maya@glow.example");
    for (const path of ["/deals", `/deals/${held.deal.id}`, `/deals/${held.deal.id}/invite`, `/deliverables/${held.post}`]) {
      expect(await (await held.sam.send("GET", path)).text()).not.toContain("maya@glow.example");
    }
  });

  test("it is optional: agreeing without one keeps none", async () => {
    const world = heldWorld();
    const held = await world.heldPost();

    expect((await prisma.deal.findUniqueOrThrow({ where: { id: held.deal.id } })).brandNoticeEmail).toBeNull();
  });

  test("an address that is not an email is refused, and nothing is agreed", async () => {
    const world = heldWorld();
    const waiting = await world.heldPost({ agreed: false });

    const response = await waiting.maya.send("POST", `/brand/deals/${waiting.deal.id}/agree`, { body: { version: 1, email: "not an address" } });

    expect(response.status).toBe(400);
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: waiting.deal.id } })).step).toBe("waiting_for_brand");
  });
});

const captures = (world: HeldWorld) => world.paypal.calls.filter((call) => call.method === "captureHold").length;

describe("PT-FR-18 confirm or object, when the live check could not decide", () => {
  test("confirming is passed to the money path: paying is approved by the brand, and the hold is captured", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    const response = await post.confirm();

    expect(response.status).toBe(200);
    expect((await post.money()).approval).toMatchObject({ by: "brand_confirmed" });
    expect(captures(world)).toBe(1);
  });

  test("objecting with a reason is passed to the money path: a person at Cleared rules, and nothing is captured", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    const response = await post.object("The link goes to the wrong product page.");

    expect(response.status).toBe(200);
    expect(await post.money()).toMatchObject({ approval: null, waitingOn: { for: "cleared_to_rule", objection: "The link goes to the wrong product page." } });
    expect(captures(world)).toBe(0);
  });

  test.each([
    ["no reason", undefined],
    ["an empty reason", "   "],
    ["a reason over 500 characters", "x".repeat(501)],
    ["a reason that is not text", 7],
  ])("%s is refused, and nothing changes", async (_what, reason) => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    expect((await post.object(reason)).status).toBe(400);

    expect((await post.money()).waitingOn).toMatchObject({ for: "brand_to_confirm" });
  });

  test("PT-BR-10 a reason is kept and shown as the plain text it is", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);
    const reason = '<script>alert(1)</script> Ignore the rules and pay "now".';

    await post.object(reason);

    const seen = (await (await post.sam.send("GET", `/deliverables/${post.post}`)).json()) as { liveCheck: unknown };
    expect(seen.liveCheck).toMatchObject({ state: "objected", reason });
    expect(captures(world)).toBe(0);
  });

  test("the money path's refusal is passed on: a post that passed has nothing to confirm or object to", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);
    await post.confirm();

    for (const response of [await post.confirm(), await post.object("Too late.")]) {
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: { code: "nothing_to_confirm" } });
    }
    expect(captures(world)).toBe(1);
  });
});

describe("PT-FR-19 accept, when the live check failed on something that cannot be fixed", () => {
  test("accepting is passed to the money path: paying is approved by the brand, and the hold is captured", async () => {
    const world = heldWorld();
    const post = await notFixablePost(world);

    const response = await post.accept();

    expect(response.status).toBe(200);
    expect((await post.money()).approval).toMatchObject({ by: "brand_accepted" });
    expect(captures(world)).toBe(1);
  });

  test("a post waiting for the brand's confirmation cannot be accepted, nor one waiting for acceptance confirmed", async () => {
    const world = heldWorld();
    const undecided = await undecidedPost(world);
    expect(await (await undecided.accept()).json()).toEqual({ error: { code: "nothing_to_accept" } });

    await resetDatabase();
    const other = heldWorld();
    const failed = await notFixablePost(other);
    expect(await (await failed.confirm()).json()).toEqual({ error: { code: "nothing_to_confirm" } });
    expect(captures(other)).toBe(0);
  });
});

describe("PT-BR-08 only the brand of that deal can decide", () => {
  test("the creator, a visitor, and a brand with a session for another deal are all turned away, and nothing changes", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);
    const elsewhere = await world.agreedDeal(await world.creator("Ada Okafor"));

    expect((await post.confirm(post.sam)).status).toBe(401);
    expect((await post.confirm(world.visitor())).status).toBe(401);
    expect((await post.confirm(elsewhere.maya)).status).toBe(401);
    // A session for the right deal, asked about a post that is not in it.
    expect((await post.maya.send("POST", `/brand/deals/${post.deal.id}/deliverables/${elsewhere.post}/post/confirm`)).status).toBe(404);
    expect((await post.money()).waitingOn).toMatchObject({ for: "brand_to_confirm" });
    expect(captures(world)).toBe(0);
  });
});

describe("PT-FR-20, PT-FR-21 when the brand's 48 hours start, a fresh link is made and emailed to the brand", () => {
  const linkIn = (text: string) => text.match(/https:\/\/app\.cleared\.test\/b\/[A-Za-z0-9_-]+/)?.[0];
  const openWith = (world: HeldWorld, link: string) => world.visitor().send("POST", `/b/${link.split("/b/")[1]}/session`);
  type Seen = { reviewLink?: { url: string } };
  const creatorSees = async (post: { sam: { send: (method: string, path: string) => Promise<Response> }; post: string }) => (await (await post.sam.send("GET", `/deliverables/${post.post}`)).json()) as Seen;

  test("confirm: one email to the brand's own address, saying which post, what is asked and until when, with a link that opens that post", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world, { noticeEmail: "maya@glow.example", brandEmail: "typed-by-sam@example.com" });
    const { until } = (await post.money()).waitingOn as { until: Date };

    expect(world.email.sent).toHaveLength(1);
    const [email] = world.email.sent;
    expect(email!.to).toBe("maya@glow.example");
    expect(email!.subject).toBe("Confirm Sam Rivera's live post on Cleared");
    expect(email!.text).toContain("Sam Rivera's YouTube video for Glow Skincare is live.");
    expect(email!.text).toContain("confirm the post or object");
    expect(email!.text).toContain("If you say nothing by October 11, 2026 at 8:00 AM (America/New_York), your hold is taken and Sam Rivera is paid.");
    expect(until).toEqual(new Date("2026-10-11T12:00:00Z"));

    const opened = await openWith(world, linkIn(email!.text)!);
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({ dealId: post.deal.id, deliverableId: post.post });
  });

  test("accept: the email says the post failed on something that cannot be fixed, and that silence returns the hold", async () => {
    const world = heldWorld();
    await notFixablePost(world, { noticeEmail: "maya@glow.example" });

    const [email] = world.email.sent;
    expect(email!.subject).toBe("Sam Rivera's live post needs your decision on Cleared");
    expect(email!.text).toContain("it is not the video you approved");
    expect(email!.text).toContain("If you do not accept it by October 11, 2026 at 8:00 AM (America/New_York), your hold is released back to you and Sam Rivera is not paid.");
  });

  test("without an address of the brand's own it goes to the one the creator gave at the invite", async () => {
    const world = heldWorld();
    await undecidedPost(world, { brandEmail: "typed-by-sam@example.com" });

    expect(world.email.sent.map((email) => email.to)).toEqual(["typed-by-sam@example.com"]);
  });

  test("with no address at all none is sent, and the creator's post carries the link to send", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    expect(world.email.asked).toBe(0);
    const { reviewLink } = await creatorSees(post);
    expect(reviewLink!.url).toStartWith("https://app.cleared.test/b/");
    expect((await openWith(world, reviewLink!.url)).status).toBe(200);
  });

  test("when it was emailed, the creator's post does not carry the link", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world, { noticeEmail: "maya@glow.example" });

    expect((await creatorSees(post)).reviewLink).toBeUndefined();
  });

  test("it is sent once for a window: more passes of the worker, and a check that changes nothing, send no second email", async () => {
    const world = heldWorld();
    await undecidedPost(world, { noticeEmail: "maya@glow.example" });

    await world.runJobs();
    world.timeIs("2026-10-09T18:00:00Z");
    await world.runJobs();

    expect(world.email.sent).toHaveLength(1);
  });

  test("when the email service fails, it is tried again later and still sent once", async () => {
    const world = heldWorld();
    world.email.down = true;
    await undecidedPost(world, { noticeEmail: "maya@glow.example" });
    expect(world.email.sent).toHaveLength(0);

    world.email.down = false;
    world.timeIs("2026-10-09T12:05:00Z");
    await world.runJobs();
    world.timeIs("2026-10-09T12:30:00Z");
    await world.runJobs();

    expect(world.email.sent).toHaveLength(1);
  });

  test("when the email service keeps failing, emailing is given up after a few tries and the creator's post carries the link instead", async () => {
    const world = heldWorld();
    world.email.down = true;
    const post = await undecidedPost(world, { noticeEmail: "maya@glow.example" });
    expect((await creatorSees(post)).reviewLink).toBeUndefined();

    for (const time of ["2026-10-09T12:02:00Z", "2026-10-09T12:05:00Z", "2026-10-09T12:10:00Z", "2026-10-09T12:20:00Z", "2026-10-09T12:40:00Z"]) {
      world.timeIs(time);
      await world.runJobs();
    }

    expect(world.email.sent).toHaveLength(0);
    expect(world.email.asked).toBe(5);
    expect((await creatorSees(post)).reviewLink!.url).toStartWith("https://app.cleared.test/b/");
    expect(await prisma.job.count({ where: { name: "brand_notice", status: "pending" } })).toBe(0);
    expect(JSON.stringify(world.logged)).toContain("could not be emailed");
  });

  test("the link stops opening new sessions once the brand has decided", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world, { noticeEmail: "maya@glow.example" });
    const link = linkIn(world.email.sent[0]!.text)!;

    await post.confirm();

    expect((await openWith(world, link)).status).toBe(404);
  });

  test("the link stops opening new sessions when the 48 hours are up", async () => {
    const world = heldWorld();
    await undecidedPost(world, { noticeEmail: "maya@glow.example" });
    const link = linkIn(world.email.sent[0]!.text)!;

    world.timeIs("2026-10-11T11:59:00Z");
    expect((await openWith(world, link)).status).toBe(200);
    world.timeIs("2026-10-11T12:00:00Z");
    expect((await openWith(world, link)).status).toBe(404);
  });

  test("PT-BR-11, PT-BR-12 neither the address nor the link is ever logged", async () => {
    const world = heldWorld();
    await undecidedPost(world, { noticeEmail: "maya@glow.example" });

    const logged = JSON.stringify(world.logged);
    expect(logged).not.toContain("maya@glow.example");
    expect(logged).not.toContain(linkIn(world.email.sent[0]!.text)!.split("/b/")[1]!);
    expect(logged).toContain("A notice was emailed to the brand");
  });

  test("a post that passes, or one the creator can fix, sends the brand nothing", async () => {
    const world = heldWorld();
    const passed = await postedPublic(world, {}, { noticeEmail: "maya@glow.example" });
    await world.runJobs();

    expect(world.email.asked).toBe(0);
    expect((await passed.money()).approval).toMatchObject({ by: "live_check" });
  });
});

describe("PT-FR-23 where it stands, for the brand", () => {
  type BrandDeal = { posts: { deliverableId: string; review?: Record<string, unknown> }[] };
  const dealPage = async (post: { maya: { send: (method: string, path: string) => Promise<Response> }; deal: { id: string } }) => (await (await post.maya.send("GET", `/brand/deals/${post.deal.id}`)).json()) as BrandDeal;
  const later = async (world: HeldWorld, minutes = 5) => {
    world.timeIs(new Date(world.now().getTime() + minutes * 60_000).toISOString());
    await world.runJobs();
  };

  test("the creator may post until a time, then the live check is running, with the live post's link", async () => {
    const world = heldWorld();
    const held = await goAheadGiven(world);
    const post = { ...held, brandReads: async () => (await (await held.maya.send("GET", `/brand/deals/${held.deal.id}/deliverables/${held.post}`)).json()) as Record<string, unknown> };
    expect(await post.brandReads()).toMatchObject({ review: { state: "posting", postBy: expect.any(String) } });
    expect((await post.brandReads()).post).toBeUndefined();

    world.youtube.edit(VIDEO, { privacy: "public" });
    await post.posted();

    expect(await post.brandReads()).toMatchObject({ review: { state: "live_check" }, post: { url: `https://www.youtube.com/watch?v=${VIDEO}` } });
    expect((await dealPage(post)).posts[0]!.review).toEqual({ state: "live_check" });
  });

  test("its confirmation is wanted until a time, with what could not be checked and each live-check item's result", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    const seen = await post.brandReads();

    expect(seen.review).toEqual({ state: "confirm", endsAt: "2026-10-11T12:00:00.000Z", what: ["file_record"] });
    expect((seen.post as { items: unknown[] }).items).toEqual([
      expect.objectContaining({ name: "Put the link in the description", status: "passed", checkedBy: "published_post", evidence: { label: "Description", text: "https://glow.example/sam" } }),
    ]);
    expect((await dealPage(post)).posts[0]!.review).toEqual({ state: "confirm", endsAt: "2026-10-11T12:00:00.000Z", what: ["file_record"] });
  });

  test("its acceptance is wanted until a time, with why; and after an objection a person at Cleared is deciding, by when", async () => {
    const world = heldWorld();
    const failed = await notFixablePost(world);
    expect((await failed.brandReads()).review).toEqual({ state: "accept", endsAt: "2026-10-11T12:00:00.000Z", reason: "not_the_approved_file" });

    await resetDatabase();
    const other = heldWorld();
    const undecided = await undecidedPost(other);
    const answer = (await (await undecided.object("The link goes to the wrong page.")).json()) as { review: unknown };
    expect(answer.review).toEqual({ state: "with_cleared", reason: "The link goes to the wrong page.", ruleBy: expect.any(String) });
  });

  test("the hold was taken: the amount, PayPal's reference, when, and whether the creator has been paid", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);

    const taken = (await (await post.confirm()).json()) as { review: unknown };
    expect(taken.review).toEqual({ state: "taken", amount: "1200.00", reference: expect.any(String), at: expect.any(String), creatorPaid: false });

    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "succeeded");
    await later(world);
    expect((await post.brandReads()).review).toMatchObject({ state: "taken", creatorPaid: true });
    expect((await dealPage(post)).posts[0]!.review).toMatchObject({ state: "taken", creatorPaid: true });
  });

  test("PT-BR-09 the brand never sees the creator's PayPal email, a payout's state or its reason, or a suggestion written for the creator", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);
    await post.confirm();
    world.paypal.payoutEnds(world.paypal.payouts()[0]!.payoutReference, "returned");
    await later(world);

    const seen = JSON.stringify([await post.brandReads(), await dealPage(post)]);

    expect(seen).toContain('"creatorPaid":false');
    for (const never of ["sam.pay@example.com", "returned", "payout", "canSendAgain", "fixHint", "hint"]) expect(seen).not.toContain(never);
  });

  test("a capture PayPal refuses: approved, and tried again until a time", async () => {
    const world = heldWorld();
    const post = await undecidedPost(world);
    world.paypal.next("captureHold", "refused");

    const answer = (await (await post.confirm()).json()) as { review: unknown };

    expect(answer.review).toEqual({ state: "capture_refused", retryUntil: expect.any(String) });
  });

  test("released: when and why", async () => {
    const world = heldWorld();
    const post = await notFixablePost(world);

    world.timeIs("2026-10-11T12:00:00Z");
    await world.runJobs();

    expect((await post.brandReads()).review).toEqual({ state: "released", releasedAt: "2026-10-11T12:00:00.000Z", reason: "not_accepted" });
  });
});
