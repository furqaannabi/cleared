import { describe, expect, test } from "bun:test";
import { newMoney, transition, type MoneyEvent, type MoneyState, type MoneyTerms } from "./transition";

const at = (iso: string) => new Date(iso);

/** Runs events in order through the public interface and returns the last state. Fails if any is refused. */
function after(state: MoneyState, ...events: MoneyEvent[]): MoneyState {
  return events.reduce((current, event) => {
    const result = transition(current, event);
    if (!result.ok) throw new Error(`${event.type} was refused: ${result.reason}`);
    return result.state;
  }, state);
}

/** A deliverable whose terms the brand has agreed. */
function agreedDeliverable(terms: Partial<MoneyTerms> = {}): MoneyState {
  const money = newMoney({
    amountCents: 120_000,
    deadlineDays: 14,
    creatorTimeZone: "Africa/Lagos",
    ...terms,
  });
  return after(money, { type: "brand_agreed", at: at("2026-10-10T08:00:00Z") });
}

describe("MP-FR-01 start a hold", () => {
  test("an agreed deliverable starts a hold attempt for its amount", () => {
    const result = transition(agreedDeliverable({ amountCents: 120_000 }), {
      type: "start_hold",
      attemptId: "att_1",
      at: at("2026-10-10T09:00:00Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      effects: [{ type: "create_order", attemptId: "att_1", amountCents: 120_000 }],
    });
  });
});

/** A deliverable with a hold attempt whose PayPal order exists and awaits the brand's approval. */
function awaitingApproval(terms: Partial<MoneyTerms> = {}): MoneyState {
  return after(
    agreedDeliverable(terms),
    { type: "start_hold", attemptId: "att_1", at: at("2026-10-10T09:00:00Z") },
    { type: "order_created", attemptId: "att_1", orderId: "ORDER-1", at: at("2026-10-10T09:00:01Z") },
  );
}

describe("MP-FR-03 approved", () => {
  const approved: MoneyEvent = { type: "hold_approved", orderId: "ORDER-1", at: at("2026-10-10T09:05:00Z") };

  test("an approved order is authorized, and checked on again in 24 hours", () => {
    expect(transition(awaitingApproval(), approved)).toMatchObject({
      ok: true,
      effects: [
        { type: "authorize_order", attemptId: "att_1", orderId: "ORDER-1" },
        { type: "schedule_job", job: "attempt_stuck", attemptId: "att_1", at: at("2026-10-11T09:05:00Z") },
      ],
    });
  });

  test("an order id that is not this deliverable's is refused", () => {
    expect(transition(awaitingApproval(), { ...approved, orderId: "ORDER-OTHER" })).toEqual({
      ok: false,
      reason: "wrong_order",
    });
  });

  test("a repeated report that the order was created does not undo the approval", () => {
    const once = after(awaitingApproval(), approved);
    const again: MoneyEvent = { type: "order_created", attemptId: "att_1", orderId: "ORDER-1", at: at("2026-10-10T09:06:00Z") };

    expect(transition(once, again)).toEqual({ ok: true, state: once, effects: [] });
  });

  test("an approval sent twice authorizes once", () => {
    const once = after(awaitingApproval(), approved);

    expect(transition(once, approved)).toEqual({ ok: true, state: once, effects: [] });
  });
});

/** A deliverable whose attempt the brand approved and PayPal has been asked to authorize. */
function authorizing(terms: Partial<MoneyTerms> = {}): MoneyState {
  return after(awaitingApproval(terms), {
    type: "hold_approved",
    orderId: "ORDER-1",
    at: at("2026-10-10T09:05:00Z"),
  });
}

describe("MP-FR-04 held", () => {
  const held = (heldAt: string): MoneyEvent => ({
    type: "authorize_answered",
    attemptId: "att_1",
    outcome: "held",
    reference: "AUTH-1",
    at: at(heldAt),
  });

  test("a held answer records the reference and fixes the deadline, the guarantee end and day 28", () => {
    const result = transition(authorizing({ deadlineDays: 14, creatorTimeZone: "Africa/Lagos" }), held("2026-10-10T09:05:10Z"));

    expect(result).toMatchObject({
      ok: true,
      state: {
        stage: "held",
        hold: {
          reference: "AUTH-1",
          heldAt: at("2026-10-10T09:05:10Z"),
          // 23:59 in Lagos (UTC+1) on 24 October, 14 days after the hold.
          deadlineAt: at("2026-10-24T22:59:00Z"),
          guaranteeEndsAt: at("2026-10-13T09:05:10Z"),
          day28At: at("2026-11-07T09:05:10Z"),
        },
      },
    });
  });

  test("the deadline and day 28 are scheduled as jobs", () => {
    const result = transition(authorizing(), held("2026-10-10T09:05:10Z"));

    expect(result).toMatchObject({
      ok: true,
      effects: [
        { type: "schedule_job", job: "deadline", at: at("2026-10-24T22:59:00Z") },
        { type: "schedule_job", job: "day_28", at: at("2026-11-07T09:05:10Z") },
      ],
    });
  });

  test("the deadline's date is counted in the creator's timezone, across a clock change", () => {
    // 06:30 UTC on 25 October is still 24 October in Los Angeles. Fourteen days on is
    // 7 November, after the clocks go back, so 23:59 there is 07:59 UTC on the 8th.
    const result = transition(
      authorizing({ deadlineDays: 14, creatorTimeZone: "America/Los_Angeles" }),
      held("2026-10-25T06:30:00Z"),
    );

    expect(result).toMatchObject({ ok: true, state: { hold: { deadlineAt: at("2026-11-08T07:59:00Z") } } });
  });
});

/** PayPal's answer to authorizing attempt att_1. */
function answered(outcome: "held" | "declined" | "pending" | "unknown", time = "2026-10-10T09:05:10Z"): MoneyEvent {
  return outcome === "held"
    ? { type: "authorize_answered", attemptId: "att_1", outcome, reference: "AUTH-1", at: at(time) }
    : { type: "authorize_answered", attemptId: "att_1", outcome, at: at(time) };
}

const startAgain: MoneyEvent = { type: "start_hold", attemptId: "att_2", at: at("2026-10-10T10:00:00Z") };

describe("MP-FR-03 declined", () => {
  test("a declined answer holds nothing and the brand can start again", () => {
    const declined = after(authorizing(), answered("declined"));

    expect(declined).toMatchObject({ stage: "not_held", hold: null, attempt: { status: "declined" } });
    expect(transition(declined, startAgain)).toMatchObject({
      ok: true,
      effects: [{ type: "create_order", attemptId: "att_2" }],
    });
  });
});

describe("MP-FR-05 closed", () => {
  const closed: MoneyEvent = { type: "hold_closed", orderId: "ORDER-1", at: at("2026-10-10T09:03:00Z") };

  test("closing PayPal holds nothing and the brand can start again", () => {
    const state = after(awaitingApproval(), closed);

    expect(state).toMatchObject({ stage: "not_held", hold: null, attempt: { status: "closed" } });
    expect(transition(state, startAgain).ok).toBe(true);
  });

  test("an order id that is not this deliverable's is refused", () => {
    expect(transition(awaitingApproval(), { ...closed, orderId: "ORDER-OTHER" })).toEqual({
      ok: false,
      reason: "wrong_order",
    });
  });
});

describe("MP-FR-06 pending and unknown", () => {
  test.each(["pending", "unknown"] as const)("a %s answer is followed up with PayPal", (outcome) => {
    expect(transition(authorizing(), answered(outcome))).toMatchObject({
      ok: true,
      state: { stage: "not_held", attempt: { status: outcome } },
      effects: [{ type: "check_attempt", attemptId: "att_1" }],
    });
  });

  test("a later held answer settles a pending attempt", () => {
    const pending = after(authorizing(), answered("pending"));

    expect(transition(pending, answered("held", "2026-10-10T11:00:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "held", hold: { reference: "AUTH-1", heldAt: at("2026-10-10T11:00:00Z") } },
    });
  });

  test("a held answer delivered twice changes nothing the second time", () => {
    const held = after(authorizing(), answered("held"));

    expect(transition(held, answered("held", "2026-10-10T12:00:00Z"))).toEqual({ ok: true, state: held, effects: [] });
  });
});

describe("MP-FR-07 a stuck attempt", () => {
  // The attempt was approved at 09:05 on 10 October, so it is due 24 hours later.
  const stuckDue: MoneyEvent = { type: "attempt_stuck_due", attemptId: "att_1", at: at("2026-10-11T09:05:00Z") };

  test.each([
    ["pending", () => after(authorizing(), answered("pending"))],
    ["unknown", () => after(authorizing(), answered("unknown"))],
    ["not answered at all", () => authorizing()],
  ] as const)("an attempt still %s after 24 hours is cancelled with PayPal and declined", (_, stuck) => {
    expect(transition(stuck(), stuckDue)).toMatchObject({
      ok: true,
      state: { stage: "not_held", hold: null, attempt: { status: "declined", declinedBecause: "timed_out" } },
      effects: [{ type: "cancel_attempt", attemptId: "att_1", orderId: "ORDER-1" }],
    });
  });

  test("the brand can start again afterwards", () => {
    const timedOut = after(authorizing(), answered("pending"), stuckDue);

    expect(transition(timedOut, startAgain).ok).toBe(true);
  });

  test("an attempt that was held in the meantime is left alone", () => {
    const held = after(authorizing(), answered("held"));

    expect(transition(held, stuckDue)).toEqual({ ok: true, state: held, effects: [] });
  });

  test("an answer that arrives after the attempt was cancelled changes nothing", () => {
    const timedOut = after(authorizing(), answered("pending"), stuckDue);

    expect(transition(timedOut, answered("held", "2026-10-11T09:06:00Z"))).toEqual({
      ok: true,
      state: timedOut,
      effects: [],
    });
  });
});

describe("MP-FR-08 never held", () => {
  // The brand agreed at 08:00 on 10 October.
  const neverHeldDue: MoneyEvent = { type: "never_held_due", at: at("2026-10-17T08:00:00Z") };

  test("agreeing schedules the check for 7 days later", () => {
    const money = newMoney({ amountCents: 120_000, deadlineDays: 14, creatorTimeZone: "Africa/Lagos" });

    expect(transition(money, { type: "brand_agreed", at: at("2026-10-10T08:00:00Z") })).toMatchObject({
      ok: true,
      effects: [{ type: "schedule_job", job: "never_held", at: at("2026-10-17T08:00:00Z") }],
    });
  });

  test("a deliverable with no hold after 7 days is closed as not held", () => {
    expect(transition(agreedDeliverable(), neverHeldDue)).toMatchObject({
      ok: true,
      state: { stage: "closed_not_held" },
      effects: [],
    });
  });

  test("a held deliverable is left alone", () => {
    const held = after(authorizing(), answered("held"));

    expect(transition(held, neverHeldDue)).toEqual({ ok: true, state: held, effects: [] });
  });

  test("once closed, a hold can no longer be started or approved", () => {
    const closed = after(awaitingApproval(), neverHeldDue);

    expect(transition(closed, startAgain)).toEqual({ ok: false, reason: "closed_not_held" });
    expect(
      transition(closed, { type: "hold_approved", orderId: "ORDER-1", at: at("2026-10-17T08:01:00Z") }),
    ).toEqual({ ok: false, reason: "closed_not_held" });
  });

  test("it waits while PayPal has not answered an approved attempt", () => {
    expect(transition(after(authorizing(), answered("pending")), neverHeldDue)).toEqual({
      ok: false,
      reason: "attempt_in_progress",
    });
  });
});

describe("MP-FR-02 when a start is refused", () => {
  const start: MoneyEvent = { type: "start_hold", attemptId: "att_1", at: at("2026-10-10T09:00:00Z") };

  test("when the deliverable is already held", () => {
    expect(transition(after(authorizing(), answered("held")), startAgain)).toEqual({
      ok: false,
      reason: "already_held",
    });
  });

  test.each(["pending", "unknown"] as const)("while an earlier attempt is %s", (outcome) => {
    expect(transition(after(authorizing(), answered(outcome)), startAgain)).toEqual({
      ok: false,
      reason: "attempt_in_progress",
    });
  });

  test("while PayPal has not yet answered an approved attempt", () => {
    expect(transition(authorizing(), startAgain)).toEqual({ ok: false, reason: "attempt_in_progress" });
  });

  test("but not while the last attempt was never approved", () => {
    expect(transition(awaitingApproval(), startAgain)).toMatchObject({
      ok: true,
      state: { attempt: { id: "att_2", status: "creating" } },
    });
  });

  test("before the brand has agreed", () => {
    const notAgreed = newMoney({ amountCents: 120_000, deadlineDays: 14, creatorTimeZone: "Africa/Lagos" });

    expect(transition(notAgreed, start)).toEqual({ ok: false, reason: "not_agreed" });
  });
});

describe("MP-FR-09 amount limits", () => {
  const start: MoneyEvent = { type: "start_hold", attemptId: "att_1", at: at("2026-10-10T09:00:00Z") };

  test("a hold below $20.00 is refused", () => {
    expect(transition(agreedDeliverable({ amountCents: 1_999 }), start)).toEqual({
      ok: false,
      reason: "amount_below_minimum",
    });
  });

  test("a hold above $10,000.00 is refused", () => {
    expect(transition(agreedDeliverable({ amountCents: 1_000_001 }), start)).toEqual({
      ok: false,
      reason: "amount_above_maximum",
    });
  });

  test("$20.00 and $10,000.00 are both allowed", () => {
    expect(transition(agreedDeliverable({ amountCents: 2_000 }), start).ok).toBe(true);
    expect(transition(agreedDeliverable({ amountCents: 1_000_000 }), start).ok).toBe(true);
  });
});
