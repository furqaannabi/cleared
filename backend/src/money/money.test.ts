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
import { recordedPosts } from "./published-post";

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
async function agreedDeliverable({ money, timeIs }: Pick<World, "money" | "timeIs">, deliverableId = "del_1") {
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
async function heldDeliverable(world: World, id = "del_1") {
  const deliverableId = await agreedDeliverable(world, id);
  const orderId = await approvedInPayPal(world, deliverableId);
  world.timeIs("2026-10-10T09:05:10Z");
  await world.money.holdApproved(deliverableId, orderId);
  return deliverableId;
}

/** A held deliverable whose draft was cleared to publish at 12:00 on 10 October. */
async function readyToPublish(world: World, id = "del_1") {
  const deliverableId = await heldDeliverable(world, id);
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

/**
 * A deliverable whose approved post is live. The go-ahead was given at 10:00 on 15 October (the hold was
 * renewed, so it is guaranteed to 10:00 on the 18th), the post went up at 09:30 on the 16th, and it is
 * now 09:40 on the 16th.
 */
async function published(world: World, id = "del_1") {
  const deliverableId = await readyToPublish(world, id);
  world.timeIs("2026-10-15T10:00:00Z");
  await world.money.askGoAhead(deliverableId);
  world.postPublished(deliverableId, "2026-10-16T09:30:00Z");
  world.timeIs("2026-10-16T09:35:00Z");
  await world.money.postPublished(deliverableId, at("2026-10-16T09:30:00Z"));
  world.timeIs("2026-10-16T09:40:00Z");
  return deliverableId;
}

/** A deliverable captured at 09:40 on 16 October, with its payout sent and not yet reported on. */
async function captured(world: World) {
  const deliverableId = await published(world);
  await world.money.liveCheckResult(deliverableId, "passed");
  return deliverableId;
}

const payoutReference = (world: World, index = 0) => world.paypal.payouts()[index]!.payoutReference;

describe("MP-FR-16 and MP-FR-17 published, and the live check passed", () => {
  test("a passing live check captures the hold in full and sends the creator the amount less the fee", async () => {
    const world = setUp();
    const deliverableId = await published(world);

    expect(await world.money.liveCheckResult(deliverableId, "passed")).toMatchObject({ ok: true });

    expect(world.paypal.capturedCents()).toBe(120_000);
    expect(world.paypal.payouts()).toMatchObject([{ email: "creator@example.com", amountCents: 114_000 }]);
    expect(await world.money.view(deliverableId)).toMatchObject({
      stage: "captured",
      approval: { by: "live_check" },
      capture: { status: "completed", reference: expect.any(String) },
      feeCents: 6_000,
      payoutCents: 114_000,
      payout: { status: "sending" },
    });
  });

  test("the deliverable is paid only when PayPal reports the payout arrived (MP-FR-29, MP-FR-31)", async () => {
    const world = setUp();
    const deliverableId = await captured(world);
    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured" });

    world.paypal.payoutEnds(payoutReference(world), "succeeded");
    world.timeIs("2026-10-16T09:45:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "paid", payout: { status: "paid" } });
    expect(world.paypal.paidOutCents()).toBe(114_000);
  });

  test("a result for a post that was never reported published is refused", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);

    expect(await world.money.liveCheckResult(deliverableId, "passed")).toEqual({ ok: false, reason: "not_published" });
    expect(world.paypal.capturedCents()).toBe(0);
  });

  test("a second passing result does not capture or pay again (MP-BR-03, MP-BR-04)", async () => {
    const world = setUp();
    const deliverableId = await captured(world);

    await world.money.liveCheckResult(deliverableId, "passed");

    expect(callsTo(world, "captureHold")).toHaveLength(1);
    expect(world.paypal.payouts()).toHaveLength(1);
  });
});

describe("MP-FR-18 and MP-FR-19 the live check cannot decide", () => {
  test("the brand has 48 hours and is told; confirming captures the hold", async () => {
    const world = setUp();
    const deliverableId = await published(world);

    await world.money.liveCheckResult(deliverableId, "cannot_decide");

    expect(await world.money.view(deliverableId)).toMatchObject({
      stage: "held",
      waitingOn: { for: "brand_to_confirm", until: at("2026-10-18T09:40:00Z") },
    });
    expect(await notices()).toContainEqual({ about: "confirm_live_post", to: "brand" });

    expect(await world.money.brandConfirmed(deliverableId)).toMatchObject({ ok: true });
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", approval: { by: "brand_confirmed" } });
  });

  test("48 hours of silence captures the hold", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "cannot_decide");

    world.timeIs("2026-10-18T09:40:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", approval: { by: "brand_silence" } });
  });

  test("an objection goes to a person at Cleared, and silence no longer pays", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "cannot_decide");

    await world.money.brandObjected(deliverableId, "The link goes to the wrong page.");
    world.timeIs("2026-10-18T09:40:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", waitingOn: { for: "cleared_to_rule" } });
    expect(await notices()).toContainEqual({ about: "brand_objected", to: "cleared" });
    expect(world.paypal.capturedCents()).toBe(0);
  });

  test("Cleared ruling to pay captures the hold, re-confirming it first because its guarantee has ended (MP-FR-24)", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "cannot_decide");
    await world.money.brandObjected(deliverableId, "The link goes to the wrong page.");
    const heldBefore = holdReference(world);

    // The guarantee ended at 10:00 on the 18th.
    world.timeIs("2026-10-20T10:00:00Z");
    expect(await world.money.clearedRuled(deliverableId, "pay")).toMatchObject({ ok: true });

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", approval: { by: "cleared" } });
    expect(callsTo(world, "renewHold")).toHaveLength(2);
    expect(callsTo(world, "captureHold")[0]!.reference).not.toBe(heldBefore);
    expect(world.paypal.capturedCents()).toBe(120_000);
  });

  test("Cleared ruling not to pay gives the hold back to the brand (MP-FR-32)", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "cannot_decide");
    await world.money.brandObjected(deliverableId, "The link goes to the wrong page.");

    world.timeIs("2026-10-17T12:00:00Z");
    await world.money.clearedRuled(deliverableId, "release");

    expect(await world.money.view(deliverableId)).toMatchObject({
      stage: "released",
      release: { reason: "cleared_ruled", confirmedAt: at("2026-10-17T12:00:00Z") },
    });
    expect(holdReference(world)).toBeUndefined();
    expect(world.paypal.capturedCents()).toBe(0);
  });
});

describe("MP-FR-20 and MP-FR-21 the live check failed", () => {
  test("a fixable failure gives the creator until the deadline; a pass inside it captures the hold", async () => {
    const world = setUp();
    const deliverableId = await published(world);

    await world.money.liveCheckResult(deliverableId, "failed_fixable");
    expect(await world.money.view(deliverableId)).toMatchObject({
      waitingOn: { for: "creator_to_fix", until: at("2026-10-24T22:59:00Z") },
    });
    expect(await notices()).toContainEqual({ about: "fix_live_post", to: "creator" });

    world.timeIs("2026-10-17T09:00:00Z");
    await world.money.liveCheckResult(deliverableId, "passed");
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured" });
  });

  test("still failing when the fix window ends, the hold is released", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "failed_fixable");

    world.timeIs("2026-10-24T22:59:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "released", release: { reason: "fix_window_ended" } });
    expect(holdReference(world)).toBeUndefined();
  });

  test("a failure that cannot be fixed needs the brand to accept: accepting captures, silence releases", async () => {
    const accepting = setUp();
    const accepted = await published(accepting);
    await accepting.money.liveCheckResult(accepted, "failed_not_fixable");
    expect(await notices()).toContainEqual({ about: "accept_failed_post", to: "brand" });
    await accepting.money.brandAccepted(accepted);
    expect(await accepting.money.view(accepted)).toMatchObject({ stage: "captured", approval: { by: "brand_accepted" } });

    const silent = setUp();
    const ignored = await published(silent, "del_2");
    await silent.money.liveCheckResult(ignored, "failed_not_fixable");
    silent.timeIs("2026-10-18T09:40:00Z");
    await silent.runJobs();
    expect(await silent.money.view(ignored)).toMatchObject({ stage: "released", release: { reason: "not_accepted" } });
    expect(silent.paypal.capturedCents()).toBe(0);
  });
});

describe("MP-FR-22 and MP-FR-23 the deadline and day 28", () => {
  test("with no approved post published by the deadline, the hold is released", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);

    world.timeIs("2026-10-24T22:59:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "released", release: { reason: "deadline" } });
    expect(holdReference(world)).toBeUndefined();
  });

  test("a post the live check finds was published in time keeps its hold, and is recorded", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.postPublished(deliverableId, "2026-10-24T22:50:00Z");

    world.timeIs("2026-10-24T22:59:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", publishedAt: at("2026-10-24T22:50:00Z") });
    expect(holdReference(world)).toBeDefined();
  });

  test("a hold still undecided on day 28 is released", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    await world.money.liveCheckResult(deliverableId, "cannot_decide");
    await world.money.brandObjected(deliverableId, "The link goes to the wrong page.");

    world.timeIs("2026-11-07T09:05:10Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "released", release: { reason: "day_28" } });
    expect(world.paypal.capturedCents()).toBe(0);
  });
});

describe("MP-FR-25 and MP-FR-26 a capture that does not go through", () => {
  test("a refused capture tells both sides once and is tried again 6 hours later", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    world.paypal.next("captureHold", "refused");

    await world.money.liveCheckResult(deliverableId, "passed");

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", capture: { status: "refused" } });
    expect(await notices()).toEqual(
      expect.arrayContaining([
        { about: "capture_failed", to: "creator" },
        { about: "payment_failed", to: "brand" },
      ]),
    );

    world.timeIs("2026-10-16T15:40:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured" });
    expect(world.paypal.capturedCents()).toBe(120_000);
    const sent = callsTo(world, "captureHold");
    expect(sent).toHaveLength(2);
    // A new try after a clear refusal goes under a new request id (MP-BR-06).
    expect(sent[1]!.requestId).not.toBe(sent[0]!.requestId!);
  });

  test("a capture PayPal did not clearly answer is followed up under the same request id, and takes the money once", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    world.paypal.next("captureHold", "timeout_after");

    await world.money.liveCheckResult(deliverableId, "passed");
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "held", capture: { status: "started" } });

    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured" });
    expect(world.paypal.capturedCents()).toBe(120_000);
    const sent = callsTo(world, "captureHold");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId!);
  });
});

describe("MP-FR-29 and MP-FR-30 a payout that does not arrive", () => {
  test("an unclaimed payout stays captured and the creator is told to accept it", async () => {
    const world = setUp();
    const deliverableId = await captured(world);
    world.paypal.payoutEnds(payoutReference(world), "unclaimed");

    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", payout: { status: "unclaimed" } });
    expect(await notices()).toContainEqual({ about: "payout_unclaimed", to: "creator" });
  });

  test("an unclaimed payout is cancelled before a new one goes to the creator's corrected email", async () => {
    const world = setUp();
    const deliverableId = await captured(world);
    world.paypal.payoutEnds(payoutReference(world), "unclaimed");
    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();

    await world.money.changePayoutEmail(deliverableId, "right@example.com");
    expect(await world.money.payoutRetry(deliverableId)).toMatchObject({ ok: true });

    expect(world.paypal.payouts()).toMatchObject([
      { email: "creator@example.com", status: { outcome: "returned" } },
      { email: "right@example.com", amountCents: 114_000, status: { outcome: "pending" } },
    ]);
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", payout: { status: "sending" } });
  });

  test("a failed payout tells the creator, and can be sent again", async () => {
    const world = setUp();
    const deliverableId = await captured(world);
    world.paypal.payoutEnds(payoutReference(world), "failed");
    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ payout: { status: "failed", why: "failed" } });
    expect(await notices()).toContainEqual({ about: "payout_failed", to: "creator" });

    expect(await world.money.payoutRetry(deliverableId)).toMatchObject({ ok: true });
    expect(world.paypal.payouts()).toHaveLength(2);
  });

  test("the creator cannot have a payout sent again while one is still being sent", async () => {
    const world = setUp();
    const deliverableId = await captured(world);

    expect(await world.money.payoutRetry(deliverableId)).toEqual({ ok: false, reason: "payout_in_progress" });
    expect(world.paypal.payouts()).toHaveLength(1);
  });

  test("a payout PayPal did not clearly accept is followed up under the same request id, and is sent once", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    world.paypal.next("sendPayout", "timeout_after");

    await world.money.liveCheckResult(deliverableId, "passed");
    world.timeIs("2026-10-16T09:41:00Z");
    await world.runJobs();

    expect(world.paypal.payouts()).toHaveLength(1);
    const sent = callsTo(world, "sendPayout");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId!);
  });
});

describe("MP-FR-45 a payout PayPal will not send", () => {
  test("it stays captured, Cleared and the creator are told, and it is sent again 6 hours later under the same id", async () => {
    const world = setUp();
    const deliverableId = await published(world);
    world.paypal.next("sendPayout", "refused");

    await world.money.liveCheckResult(deliverableId, "passed");

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", payout: { status: "not_sent" } });
    expect(await notices()).toEqual(
      expect.arrayContaining([
        { about: "payout_not_sent", to: "cleared" },
        { about: "payout_delayed", to: "creator" },
      ]),
    );
    expect(world.paypal.payouts()).toHaveLength(0);

    world.timeIs("2026-10-16T15:40:00Z");
    await world.runJobs();

    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "captured", payout: { status: "sending" } });
    expect(world.paypal.payouts()).toHaveLength(1);
    const sent = callsTo(world, "sendPayout");
    expect(sent).toHaveLength(2);
    expect(sent[1]!.requestId).toBe(sent[0]!.requestId!);
  });
});

describe("MP-FR-33 and MP-FR-34 cancelling", () => {
  test("either side can cancel a held deliverable, which gives the hold back", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    world.timeIs("2026-10-12T10:00:00Z");

    expect(await world.money.cancel(deliverableId, "brand")).toMatchObject({ ok: true });

    expect(await world.money.view(deliverableId)).toMatchObject({
      stage: "released",
      release: { reason: "cancelled", by: "brand", confirmedAt: at("2026-10-12T10:00:00Z") },
    });
    expect(holdReference(world)).toBeUndefined();
  });

  test("nobody can cancel while a go-ahead is running, or once a post is published", async () => {
    const running = setUp();
    const withGoAhead = await readyToPublish(running);
    running.timeIs("2026-10-15T10:00:00Z");
    await running.money.askGoAhead(withGoAhead);
    expect(await running.money.cancel(withGoAhead, "brand")).toEqual({ ok: false, reason: "go_ahead_running" });

    const live = setUp();
    const posted = await published(live, "del_2");
    expect(await live.money.cancel(posted, "creator")).toEqual({ ok: false, reason: "already_published" });
    expect(holdReference(live)).toBeDefined();
  });

  test("cancelling before the hold closes the deliverable, and gives back a hold PayPal makes afterwards", async () => {
    const world = setUp();
    const { deliverableId, orderId } = await approvedWith(world, "pending");

    expect(await world.money.cancel(deliverableId, "creator")).toMatchObject({ ok: true });
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "closed_not_held" });
    expect(await world.money.startHold(deliverableId)).toEqual({ ok: false, reason: "cancelled" });

    world.paypal.settlePending(orderId, "held");
    world.timeIs("2026-10-10T10:00:00Z");
    await world.runJobs();

    expect(world.paypal.holds()).toMatchObject([{ status: "ended" }]);
  });
});

describe("MP-FR-32 a release PayPal will not carry out", () => {
  test("it is put in front of a person at Cleared", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    // The hold is taken on PayPal's side without Cleared knowing, so it can no longer be given back.
    await world.paypal.captureHold({ requestId: "outside", reference: holdReference(world)!, amountCents: 120_000 });

    await world.money.cancel(deliverableId, "brand");

    expect(await notices()).toContainEqual({ about: "release_failed", to: "cleared" });
    expect(await world.money.view(deliverableId)).toMatchObject({ stage: "released", release: { reason: "cancelled" } });
  });
});

describe("MP-FR-16 what the module knows of a post until the live check exists", () => {
  test("a post is published once that has been reported to the module, and not before", async () => {
    const world = setUp();
    const deliverableId = await readyToPublish(world);
    const posts = recordedPosts(prisma);

    expect(await posts.publishedAt(deliverableId)).toBeNull();
    expect(await posts.publishedAt("no_such_deliverable")).toBeNull();

    world.timeIs("2026-10-16T09:35:00Z");
    await world.money.askGoAhead(deliverableId);
    await world.money.postPublished(deliverableId, at("2026-10-16T09:30:00Z"));

    expect(await posts.publishedAt(deliverableId)).toEqual(at("2026-10-16T09:30:00Z"));
  });
});
