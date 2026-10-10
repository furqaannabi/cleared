/**
 * Rulings by a person at Cleared (publish to paid spec PT-FR-34, PT-FR-35, PT-BR-14): what is waiting,
 * and recording "pay" or "release" with who ruled. The money path alone acts on a ruling.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { heldWorld, resetDatabase, type HeldWorld } from "../../test/held-post";
import { undecidedPost } from "../../test/live-post";
import { prisma } from "../db";
import { createRulings, printed } from "./rulings";

beforeEach(resetDatabase);

const OBJECTION = "The link goes to the wrong product page.";
const captures = (world: HeldWorld) => world.paypal.calls.filter((call) => call.method === "captureHold").length;

/** A live post the brand objected to: a person at Cleared has to rule. */
async function objected(world: HeldWorld, reason = OBJECTION) {
  const post = await undecidedPost(world);
  expect((await post.object(reason)).status).toBe(200);
  return { ...post, rulings: createRulings({ prisma, now: world.now, money: world.money }) };
}

describe("PT-FR-34 the list of posts waiting for a ruling", () => {
  test("each one with its deal, the brand's objection, what the live check found, and by when a ruling is due", async () => {
    const world = heldWorld();
    const post = await objected(world);

    expect(await post.rulings.list()).toEqual([
      {
        deliverableId: post.post,
        dealId: post.deal.id,
        brandName: "Glow Skincare",
        creatorName: "Sam Rivera",
        platform: "youtube_video",
        amount: "1200.00",
        objection: OBJECTION,
        ruleBy: (await post.money()).hold.state === "held" ? ((await post.money()).hold as { day28At: Date }).day28At : undefined,
        postUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        liveCheck: {
          answer: "cannot_decide",
          undecided: ["file_record"],
          items: [{ name: "Put the link in the description", result: "passed", evidence: "https://glow.example/sam" }],
        },
      },
    ]);
  });

  test("a post nobody objected to, and one already ruled on, are not in it", async () => {
    const world = heldWorld();
    const waiting = await undecidedPost(world);
    const rulings = createRulings({ prisma, now: world.now, money: world.money });
    expect(await rulings.list()).toEqual([]);

    await waiting.object(OBJECTION);
    expect(await rulings.list()).toHaveLength(1);
    await rulings.rule(waiting.post, "release", "Furqaan");
    expect(await rulings.list()).toEqual([]);
  });

  test("PT-BR-10 what is printed is plain text: an objection cannot move the cursor or colour the terminal", async () => {
    const world = heldWorld();
    const post = await objected(world, "Pay nothing.\u001b[2J\u001b[31m RELEASE NOW \u0007");

    const text = printed(await post.rulings.list());

    expect(text).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f]/);
    expect(text).toContain("Pay nothing.");
    expect(text).toContain(post.post);
  });
});

describe("PT-FR-35 a ruling is recorded with who made it, and passed to the money path", () => {
  test("pay: paying is approved by Cleared, the hold is captured, and the ruling is kept with the name", async () => {
    const world = heldWorld();
    const post = await objected(world);
    world.timeIs("2026-10-10T09:00:00Z");

    expect(await post.rulings.rule(post.post, "pay", "  Furqaan Nabi ")).toEqual({ ok: true });

    expect((await post.money()).approval).toMatchObject({ by: "cleared" });
    expect(captures(world)).toBe(1);
    expect(await prisma.ruling.findMany()).toEqual([{ deliverableId: post.post, decision: "pay", by: "Furqaan Nabi", at: new Date("2026-10-10T09:00:00Z") }]);
  });

  test("release: the hold goes back to the brand, with the reason that a person at Cleared ruled", async () => {
    const world = heldWorld();
    const post = await objected(world);

    expect(await post.rulings.rule(post.post, "release", "William")).toEqual({ ok: true });

    expect(await post.money()).toMatchObject({ stage: "released", release: { reason: "cleared_ruled" } });
    expect(captures(world)).toBe(0);
    expect(await prisma.ruling.findMany()).toMatchObject([{ decision: "release", by: "William" }]);
  });

  test("PT-BR-14 a ruling needs a name: without one nothing is passed to the money path", async () => {
    const world = heldWorld();
    const post = await objected(world);

    for (const name of ["", "   ", "x".repeat(121)]) expect(await post.rulings.rule(post.post, "pay", name)).toEqual({ ok: false, reason: "name_needed" });

    expect((await post.money()).waitingOn).toMatchObject({ for: "cleared_to_rule" });
    expect(await prisma.ruling.count()).toBe(0);
  });

  test("the money path decides whether there is anything to rule on: a post not waiting is refused, and no ruling is kept", async () => {
    const world = heldWorld();
    const waiting = await undecidedPost(world);
    const rulings = createRulings({ prisma, now: world.now, money: world.money });

    expect(await rulings.rule(waiting.post, "pay", "Furqaan")).toEqual({ ok: false, reason: "nothing_to_rule_on" });
    expect(await rulings.rule("no-such-post", "pay", "Furqaan")).toEqual({ ok: false, reason: "unknown_deliverable" });

    expect(captures(world)).toBe(0);
    expect(await prisma.ruling.count()).toBe(0);
  });

  test("a post already ruled on cannot be ruled on again, and the record of the first ruling stays as it is", async () => {
    const world = heldWorld();
    const post = await objected(world);
    await post.rulings.rule(post.post, "release", "William");

    expect(await post.rulings.rule(post.post, "pay", "Furqaan")).toMatchObject({ ok: false });

    expect(await prisma.ruling.findMany()).toMatchObject([{ decision: "release", by: "William" }]);
    expect(captures(world)).toBe(0);
  });

  test("PT-BR-14 no route rules: nothing a visitor can reach pays or releases on a person's say", async () => {
    const contract = JSON.stringify(Object.keys(((await Bun.file(new URL("../../../contract/openapi.json", import.meta.url)).json()) as { paths: Record<string, unknown> }).paths));

    expect(contract).not.toMatch(/rul(e|ing)/i);
  });
});
