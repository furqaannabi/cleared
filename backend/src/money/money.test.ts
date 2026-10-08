/**
 * The money module against a real Postgres, with PayPal replaced by the fake
 * (docs/decisions/2026-10-08-backend-test-tooling.md). Each test checks what someone could observe:
 * what the function answered, the money view, the money record, the jobs scheduled, and exactly which
 * calls reached PayPal.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { FakePayPal } from "../../test/fake-paypal";
import { prisma } from "../db";
import { runDueJobs } from "../jobs/jobs";
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
  // Stands in for the live check: which approved posts are published, and when.
  const published = new Map<string, Date>();
  const posts = { publishedAt: async (deliverableId: string) => published.get(deliverableId) ?? null };
  const money = createMoney({ prisma, paypal, posts, now: () => now });
  return {
    paypal,
    money,
    /** The live check finds the approved post published. */
    postPublished: (deliverableId: string, iso: string) => {
      published.set(deliverableId, at(iso));
    },
    /** Moves the clock. */
    timeIs: (iso: string) => {
      now = at(iso);
    },
    /** Runs every job that is due at the clock's time, as the service's worker would. */
    runJobs: () => runDueJobs(prisma, money.handlers, { now, log: () => {} }),
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
      // One follow-up per PayPal call, in case its answer never arrives.
      { name: "follow_up", runAt: at("2026-10-10T09:01:00Z") },
      { name: "follow_up", runAt: at("2026-10-10T09:06:10Z") },
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

/** A deliverable whose brand approved in PayPal, with PayPal misbehaving once on the hold. Approved at 09:05. */
async function approvedWith(world: World, misbehaviour: "pending" | "timeout_after" | "timeout_before") {
  const deliverableId = await agreedDeliverable(world);
  const orderId = await approvedInPayPal(world, deliverableId);
  world.timeIs("2026-10-10T09:05:00Z");
  world.paypal.next("authorizeOrder", misbehaviour);
  await world.money.holdApproved(deliverableId, orderId);
  return { deliverableId, orderId };
}

const callsTo = (world: World, method: string) => world.paypal.calls.filter((call) => call.method === method);

describe("MP-FR-05 closed", () => {
  test("closing PayPal without approving holds nothing, and the brand can start again", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const started = await world.money.startHold(deliverableId);
    if (!started.ok) throw new Error("the hold was not started");

    expect(await world.money.holdClosed(deliverableId, started.orderId)).toEqual({ ok: true, hold: { state: "closed" } });
    expect(world.paypal.holds()).toHaveLength(0);
    expect(await world.money.startHold(deliverableId)).toMatchObject({ ok: true });
  });

  test("an order id that is not this deliverable's is refused", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    await world.money.startHold(deliverableId);

    expect(await world.money.holdClosed(deliverableId, "ORDER-OTHER")).toEqual({ ok: false, reason: "wrong_order" });
  });
});

describe("MP-FR-38 following up a call PayPal did not clearly answer", () => {
  test("a pending hold that PayPal then approves becomes held", async () => {
    const world = setUp();
    const { deliverableId, orderId } = await approvedWith(world, "pending");
    world.paypal.settlePending(orderId, "held");

    world.timeIs("2026-10-10T09:06:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", hold: { state: "held", heldAt: at("2026-10-10T09:06:00Z") } });
    expect(await prisma.payPalCall.findMany({ where: { purpose: "authorize_order" } })).toMatchObject([{ status: "settled" }]);
    expect((await jobs()).map((job) => job.name)).toEqual(expect.arrayContaining(["deadline", "day_28"]));
  });

  test("a pending hold that PayPal then declines is declined", async () => {
    const world = setUp();
    const { deliverableId, orderId } = await approvedWith(world, "pending");
    world.paypal.settlePending(orderId, "declined");

    world.timeIs("2026-10-10T09:06:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "not_held", hold: { state: "declined" } });
  });

  test("a hold PayPal made but never answered for is found, not made again", async () => {
    const world = setUp();
    const { deliverableId } = await approvedWith(world, "timeout_after");

    world.timeIs("2026-10-10T09:06:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
    expect(world.paypal.holds()).toHaveLength(1);
    expect(callsTo(world, "authorizeOrder")).toHaveLength(1);
  });

  test("a request PayPal never received is sent again under the same request id, and holds once (MP-BR-06)", async () => {
    const world = setUp();
    const { deliverableId } = await approvedWith(world, "timeout_before");

    world.timeIs("2026-10-10T09:06:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
    expect(world.paypal.holds()).toHaveLength(1);
    const sent = callsTo(world, "authorizeOrder");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId!);
  });

  test("while PayPal still has no answer, it is asked again later, waiting longer each time", async () => {
    const world = setUp();
    await approvedWith(world, "pending");
    const followUpAt = async () =>
      (await prisma.job.findMany({ where: { name: "follow_up", status: "pending" }, orderBy: { runAt: "desc" } }))[0]!.runAt;

    world.timeIs("2026-10-10T09:06:00Z");
    await world.runJobs();
    const second = await followUpAt();
    world.timeIs(second.toISOString());
    await world.runJobs();
    const third = await followUpAt();

    expect(second.getTime()).toBeGreaterThan(at("2026-10-10T09:06:00Z").getTime());
    expect(third.getTime() - second.getTime()).toBeGreaterThan(second.getTime() - at("2026-10-10T09:06:00Z").getTime());
    expect(callsTo(world, "authorizeOrder")).toHaveLength(1);
  });

  test("an order PayPal did not clearly create is found under the same request id", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    world.paypal.next("createOrder", "timeout_after");
    await world.money.startHold(deliverableId);

    world.timeIs("2026-10-10T09:01:00Z");
    await world.runJobs();

    const created = callsTo(world, "createOrder");
    expect(created).toHaveLength(2);
    expect(created[1]!.requestId).toBe(created[0]!.requestId!);
    expect(await prisma.payPalCall.findMany({ where: { purpose: "create_order" } })).toMatchObject([
      { status: "settled", reference: expect.any(String) },
    ]);
  });

  test("a call left started by a crash is followed up, because its job was written with it (MP-BR-07)", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    // The service stops between recording the call and hearing from PayPal.
    const createOrder = world.paypal.createOrder.bind(world.paypal);
    let crashed = false;
    world.paypal.createOrder = async (input) => {
      if (!crashed) {
        crashed = true;
        throw new Error("the service stopped");
      }
      return createOrder(input);
    };
    await world.money.startHold(deliverableId).catch(() => {});
    expect(await prisma.payPalCall.findMany()).toMatchObject([{ purpose: "create_order", status: "started" }]);

    world.timeIs("2026-10-10T09:01:00Z");
    await world.runJobs();

    expect(await prisma.payPalCall.findMany()).toMatchObject([{ purpose: "create_order", status: "settled" }]);
  });

  test("a follow-up for a call that was answered in time does nothing", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    await world.money.holdApproved(deliverableId, orderId);
    const before = world.paypal.calls.length;

    world.timeIs("2026-10-10T10:00:00Z");
    await world.runJobs();

    expect(world.paypal.calls).toHaveLength(before);
    expect(await prisma.job.count({ where: { name: "follow_up", status: "done" } })).toBe(2);
  });
});

describe("MP-FR-07 a stuck attempt", () => {
  test("an attempt PayPal has not answered after 24 hours is declined, and the brand can start again", async () => {
    const world = setUp();
    const { deliverableId } = await approvedWith(world, "pending");

    world.timeIs("2026-10-11T09:05:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "not_held", hold: { state: "declined" } });
    expect(await world.money.startHold(deliverableId)).toMatchObject({ ok: true });
  });

  test("if PayPal holds the money after the attempt was given up, the hold is given back", async () => {
    const world = setUp();
    const { deliverableId, orderId } = await approvedWith(world, "pending");
    world.timeIs("2026-10-11T09:05:00Z");
    await world.runJobs();

    // PayPal finishes its review late and holds the money.
    world.paypal.settlePending(orderId, "held");
    world.timeIs("2026-10-11T12:00:00Z");
    await world.runJobs();

    expect(world.paypal.holds()).toMatchObject([{ status: "ended" }]);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "not_held", hold: { state: "declined" } });
    expect(await prisma.payPalCall.findMany({ where: { purpose: "cancel_attempt" } })).toMatchObject([{ status: "settled" }]);
  });

  test("an attempt that was held in the meantime is left alone", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    await world.money.holdApproved(deliverableId, orderId);

    world.timeIs("2026-10-11T09:05:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
    expect(world.paypal.holds()).toMatchObject([{ status: "in_place" }]);
  });
});

describe("MP-FR-08 never held", () => {
  test("a deliverable with no hold 7 days after the brand agreed is closed, and no hold can be started", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);

    world.timeIs("2026-10-17T08:00:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "closed_not_held" });
    expect(await world.money.startHold(deliverableId)).toEqual({ ok: false, reason: "closed_not_held" });
  });

  test("a held deliverable is left alone", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const orderId = await approvedInPayPal(world, deliverableId);
    await world.money.holdApproved(deliverableId, orderId);

    world.timeIs("2026-10-17T08:00:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
  });

  test("it waits while PayPal has not answered an approved attempt, and tries again later", async () => {
    const world = setUp();
    world.timeIs("2026-10-10T08:00:00Z");
    const deliverableId = await agreedDeliverable(world);
    // Approved in the last minutes before the 7 days are up.
    world.timeIs("2026-10-17T07:58:00Z");
    const started = await world.money.startHold(deliverableId);
    if (!started.ok) throw new Error("the hold was not started");
    world.paypal.brandApproves(started.orderId);
    world.paypal.next("authorizeOrder", "pending");
    await world.money.holdApproved(deliverableId, started.orderId);

    world.timeIs("2026-10-17T08:00:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "not_held", hold: { state: "pending" } });
    expect(await prisma.job.findMany({ where: { name: "never_held" } })).toMatchObject([
      { status: "pending", failures: 0, runAt: at("2026-10-17T09:00:00Z") },
    ]);
  });
});

/** A deliverable held at 09:05:10 UTC on 10 October: guaranteed to the 13th, deadline 22:59 UTC on the 24th. */
async function heldDeliverable(world: World) {
  const deliverableId = await agreedDeliverable(world);
  const orderId = await approvedInPayPal(world, deliverableId);
  world.timeIs("2026-10-10T09:05:10Z");
  await world.money.holdApproved(deliverableId, orderId);
  return deliverableId;
}

/** A held deliverable whose draft was cleared to publish at 12:00 on 10 October. */
async function readyToPublish(world: World) {
  const deliverableId = await heldDeliverable(world);
  world.timeIs("2026-10-10T12:00:00Z");
  await world.money.draftCleared(deliverableId);
  return deliverableId;
}

const notices = async () =>
  (await prisma.moneyRecord.findMany({ where: { kind: "notice" }, orderBy: { id: "asc" } })).map((entry) => ({
    about: entry.name,
    ...(entry.details as { to: string }),
  }));

const holdReference = (world: World) => world.paypal.holds().find((hold) => hold.status === "in_place")?.reference;

describe("MP-FR-10 asking for the go-ahead", () => {
  test("is refused before the deliverable is held, and PayPal is not asked", async () => {
    const world = setUp();
    const deliverableId = await agreedDeliverable(world);
    const before = world.paypal.calls.length;

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: false, reason: "not_held" });
    expect(world.paypal.calls).toHaveLength(before);
  });

  test("is refused until the draft is cleared to publish", async () => {
    const world = setUp();
    const deliverableId = await heldDeliverable(world);

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: false, reason: "draft_not_cleared" });
  });

  test("is refused once the deadline has passed", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);

    world.timeIs("2026-10-24T23:00:00Z");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: false, reason: "deadline_passed" });
  });
});

describe("MP-FR-11 inside the guarantee", () => {
  test("PayPal is asked whether the hold still stands, and the creator gets a go-ahead with its end time", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-10T13:00:00Z");

    // The guarantee ends at 09:05:10 on the 13th, so the go-ahead stops 24 hours before that (MP-FR-13).
    expect(await world.money.askGoAhead(deliverableId)).toEqual({
      ok: true,
      goAhead: { state: "running", until: at("2026-10-12T09:05:10Z") },
    });
    expect(callsTo(world, "readHold")).toHaveLength(1);
    expect(callsTo(world, "renewHold")).toHaveLength(0);
    expect(await jobs()).toContainEqual({ name: "go_ahead_ends", runAt: at("2026-10-12T09:05:10Z") });
  });

  test("asking again while a go-ahead is running gives the same answer without asking PayPal again", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-10T13:00:00Z");
    const first = await world.money.askGoAhead(deliverableId);

    world.timeIs("2026-10-10T15:00:00Z");

    expect(await world.money.askGoAhead(deliverableId)).toEqual(first);
    expect(callsTo(world, "readHold")).toHaveLength(1);
  });
});

describe("MP-FR-12 after the guarantee", () => {
  test("the hold is renewed, its new reference is kept, and the go-ahead lasts 48 hours", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    const oldReference = holdReference(world);
    world.timeIs("2026-10-15T10:00:00Z");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({
      ok: true,
      goAhead: { state: "running", until: at("2026-10-17T10:00:00Z") },
    });

    expect(callsTo(world, "renewHold")).toMatchObject([{ reference: oldReference, requestId: expect.any(String) }]);
    const view = await world.money.view(deliverableId);
    expect(view?.hold).toMatchObject({ state: "held", reference: holdReference(world) });
    expect(holdReference(world)).not.toBe(oldReference);
  });

  test("a renewal PayPal did not clearly answer is followed up under the same request id, and renews once (MP-BR-06)", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-15T10:00:00Z");
    world.paypal.next("renewHold", "timeout_after");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: true, goAhead: { state: "confirming" } });

    world.timeIs("2026-10-15T10:01:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ goAhead: { state: "running", until: at("2026-10-17T10:01:00Z") } });
    const sent = callsTo(world, "renewHold");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId!);
    expect(world.paypal.holds().filter((hold) => hold.status === "in_place")).toHaveLength(1);
  });
});

describe("MP-FR-13 how long a go-ahead lasts", () => {
  test("with under 24 hours of guarantee left the creator is told when to ask again, and PayPal is not asked", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-12T10:00:00Z");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({
      ok: true,
      goAhead: { state: "wait_until", until: at("2026-10-13T09:05:10Z") },
    });
    expect(callsTo(world, "readHold")).toHaveLength(0);
    expect(callsTo(world, "renewHold")).toHaveLength(0);
  });
});

describe("MP-FR-14 not confirmed", () => {
  test("a hold that no longer stands gives no go-ahead, and the brand is told", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    // The hold ends on PayPal's side without Cleared knowing.
    await world.paypal.cancelHold(holdReference(world)!);
    world.timeIs("2026-10-10T13:00:00Z");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: true, goAhead: { state: "not_confirmed" } });
    expect(await notices()).toEqual([{ about: "hold_not_confirmed", to: "brand" }]);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held" });
  });

  test("a renewal PayPal refuses gives no go-ahead, the hold stays, and the creator can ask again", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-15T10:00:00Z");
    world.paypal.next("renewHold", "refused");

    expect(await world.money.askGoAhead(deliverableId)).toEqual({ ok: true, goAhead: { state: "not_confirmed" } });
    expect(world.paypal.holds()).toMatchObject([{ status: "in_place" }]);

    world.timeIs("2026-10-16T10:00:00Z");
    expect(await world.money.askGoAhead(deliverableId)).toEqual({
      ok: true,
      goAhead: { state: "running", until: at("2026-10-18T10:00:00Z") },
    });
  });
});

describe("MP-FR-15 when a go-ahead runs out", () => {
  /** A go-ahead given at 10:00 on 15 October, running to 10:00 on the 17th. */
  async function goAheadRunning(world: World) {
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-15T10:00:00Z");
    await world.money.askGoAhead(deliverableId);
    return deliverableId;
  }

  test("with no post published, the go-ahead ends", async () => {
    const world = setUp();
    const deliverableId = await goAheadRunning(world);

    world.timeIs("2026-10-17T10:00:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", goAhead: { state: "none" }, publishedAt: null });
  });

  test("with a post published, the go-ahead is kept and the publication is recorded", async () => {
    const world = setUp();
    const deliverableId = await goAheadRunning(world);
    world.postPublished(deliverableId, "2026-10-17T09:30:00Z");

    world.timeIs("2026-10-17T10:00:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({
      goAhead: { state: "running" },
      publishedAt: at("2026-10-17T09:30:00Z"),
    });
  });

  test("it does not end early", async () => {
    const world = setUp();
    const deliverableId = await goAheadRunning(world);

    world.timeIs("2026-10-17T09:59:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ goAhead: { state: "running" } });
  });
});
