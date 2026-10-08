/**
 * The money module against a real Postgres, with PayPal replaced by the fake
 * (docs/decisions/2026-10-08-backend-test-tooling.md). Each test checks what someone could observe:
 * what the function answered, the money view, the money record, the jobs scheduled, and exactly which
 * calls reached PayPal.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { FakePayPal } from "../../test/fake-paypal";
import { prisma } from "../db";
import { createMoney } from "./money";

const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.moneyRecord.deleteMany();
  await prisma.payPalCall.deleteMany();
  await prisma.deliverableMoney.deleteMany();
  await prisma.job.deleteMany();
});

/** A money module with a fake PayPal and a clock the test moves by hand. */
function setUp(startAt = "2026-10-10T09:00:00Z") {
  const paypal = new FakePayPal();
  let now = at(startAt);
  const money = createMoney({ prisma, paypal, now: () => now });
  return {
    paypal,
    money,
    /** Moves the clock. */
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

type World = ReturnType<typeof setUp>;

/** A $1,200.00 deliverable, due 14 days after its hold, for a creator in Lagos. The brand agreed at 08:00. */
async function agreedDeliverable({ money, timeIs }: World, deliverableId = "del_1") {
  timeIs("2026-10-10T08:00:00Z");
  await money.open({
    deliverableId,
    amountCents: 120_000,
    deadlineDays: 14,
    creatorTimeZone: "Africa/Lagos",
    payoutEmail: "creator@example.com",
  });
  await money.brandAgreed(deliverableId);
  timeIs("2026-10-10T09:00:00Z");
  return deliverableId;
}

/** Starts a hold and has the brand approve it in PayPal's window. Returns the order id. */
async function approvedInPayPal(world: World, deliverableId: string) {
  const started = await world.money.startHold(deliverableId);
  if (!started.ok) throw new Error(`the hold was not started: ${started.reason}`);
  world.paypal.brandApproves(started.orderId);
  return started.orderId;
}

const jobs = async () => (await prisma.job.findMany({ orderBy: { runAt: "asc" } })).map((job) => ({ name: job.name, runAt: job.runAt }));
const recordNames = async () => (await prisma.moneyRecord.findMany({ orderBy: { id: "asc" } })).map((entry) => `${entry.kind}:${entry.name}`);

describe("MP-FR-01 start a hold", () => {
  test("an agreed deliverable gets one PayPal order for its amount, and a link for the brand to approve it", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);

    const started = await world.money.startHold(deliverableId);

    expect(started).toEqual({ ok: true, orderId: expect.any(String), approveUrl: expect.any(String) });
    expect(world.paypal.calls).toEqual([{ method: "createOrder", requestId: expect.any(String), amountCents: 120_000 }]);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "not_held", hold: { state: "not_started" } });
  });

  test("the call is recorded as started before PayPal is asked, and settled with PayPal's reference (MP-BR-07)", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);

    const started = await world.money.startHold(deliverableId);

    const calls = await prisma.payPalCall.findMany();
    expect(calls).toMatchObject([
      { purpose: "create_order", status: "settled", reference: started.ok ? started.orderId : "", requestId: world.paypal.calls[0]!.requestId },
    ]);
    expect(await recordNames()).toEqual([
      "event:brand_agreed",
      "event:start_hold",
      "paypal_call:create_order",
      "event:order_created",
    ]);
  });
});

describe("MP-FR-02 when a start is refused", () => {
  test("before the brand has agreed, nothing is sent to PayPal", async () => {
    const world = setUp();
    await world.money.open({
      deliverableId: "del_1",
      amountCents: 120_000,
      deadlineDays: 14,
      creatorTimeZone: "Africa/Lagos",
      payoutEmail: "creator@example.com",
    });

    expect(await world.money.startHold("del_1")).toEqual({ ok: false, reason: "not_agreed" });
    expect(world.paypal.calls).toEqual([]);
    expect(await prisma.payPalCall.count()).toBe(0);
  });

  test("a deliverable the module has never heard of is refused", async () => {
    const world = setUp();

    expect(await world.money.startHold("no_such_deliverable")).toEqual({ ok: false, reason: "unknown_deliverable" });
  });
});

describe("MP-BR-06 no clear answer from PayPal", () => {
  test("an order PayPal did not clearly create is left started, to be followed up, and the brand is not given a link", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    world.paypal.next("createOrder", "timeout_after");

    expect(await world.money.startHold(deliverableId)).toEqual({ ok: false, reason: "paypal_unclear" });

    expect(await prisma.payPalCall.findMany()).toMatchObject([{ purpose: "create_order", status: "started", reference: null }]);
    expect(world.paypal.calls).toHaveLength(1);
  });
});

describe("MP-FR-03 and MP-FR-04 approved and held", () => {
  test("an approved order is held: the reference, the deadline and the jobs are all in place", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    world.timeIs("2026-10-10T09:05:10Z");

    const approved = await world.money.holdApproved(deliverableId, orderId);

    expect(approved).toEqual({
      ok: true,
      hold: {
        state: "held",
        reference: expect.any(String),
        heldAt: at("2026-10-10T09:05:10Z"),
        // 23:59 in Lagos on 24 October, 14 days after the hold.
        deadlineAt: at("2026-10-24T22:59:00Z"),
      },
    });
    expect(world.paypal.holds()).toMatchObject([{ amountCents: 120_000, status: "in_place" }]);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", hold: { state: "held" } });
    expect(await jobs()).toEqual([
      { name: "attempt_stuck", runAt: at("2026-10-11T09:05:10Z") },
      { name: "never_held", runAt: at("2026-10-17T08:00:00Z") },
      { name: "deadline", runAt: at("2026-10-24T22:59:00Z") },
      { name: "day_28", runAt: at("2026-11-07T09:05:10Z") },
    ]);
  });

  test("an approval sent twice holds the money once", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);

    const first = await world.money.holdApproved(deliverableId, orderId);
    const second = await world.money.holdApproved(deliverableId, orderId);

    expect(second).toEqual(first);
    expect(world.paypal.holds()).toHaveLength(1);
    expect(world.paypal.calls.filter((call) => call.method === "authorizeOrder")).toHaveLength(1);
  });

  test("two approvals arriving at the same moment hold the money once (MP-BR-07)", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);

    await Promise.all([world.money.holdApproved(deliverableId, orderId), world.money.holdApproved(deliverableId, orderId)]);

    expect(world.paypal.calls.filter((call) => call.method === "authorizeOrder")).toHaveLength(1);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
  });

  test("an order id that is not this deliverable's is refused, and PayPal is not asked", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    await approvedInPayPal(world, deliverableId);

    expect(await world.money.holdApproved(deliverableId, "ORDER-OTHER")).toEqual({ ok: false, reason: "wrong_order" });
    expect(world.paypal.calls.filter((call) => call.method === "authorizeOrder")).toHaveLength(0);
  });

  test("a declined hold takes nothing, and the brand can start again", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    world.paypal.next("authorizeOrder", "declined");

    expect(await world.money.holdApproved(deliverableId, orderId)).toEqual({ ok: true, hold: { state: "declined" } });
    expect(world.paypal.holds()).toHaveLength(0);

    expect(await world.money.startHold(deliverableId)).toMatchObject({ ok: true });
  });
});

describe("MP-FR-06 pending and unknown", () => {
  test.each([
    ["pending", "pending"],
    ["timeout_after", "unknown"],
    ["timeout_before", "unknown"],
  ] as const)("a hold PayPal answers %s for shows as %s, is followed up, and cannot be started again", async (misbehaviour, state) => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    world.paypal.next("authorizeOrder", misbehaviour);

    expect(await world.money.holdApproved(deliverableId, orderId)).toEqual({ ok: true, hold: { state } });

    expect((await jobs()).map((job) => job.name)).toContain("check_attempt");
    expect(await prisma.payPalCall.findMany({ where: { purpose: "authorize_order" } })).toMatchObject([{ status: "started" }]);
    expect(await world.money.startHold(deliverableId)).toEqual({ ok: false, reason: "attempt_in_progress" });
  });
});

describe("MP-BR-11 and MP-BR-14 what is kept", () => {
  test("the creator's PayPal email is in neither the state, the record nor the jobs", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    await world.money.holdApproved(deliverableId, orderId);

    const row = await prisma.deliverableMoney.findUniqueOrThrow({ where: { deliverableId } });
    const kept = JSON.stringify([row.state, await prisma.moneyRecord.findMany(), await prisma.job.findMany(), await world.money.view(deliverableId)]);

    expect(kept).not.toContain("creator@example.com");
  });
});
