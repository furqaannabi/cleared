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

/** A deliverable held at 09:05:10 UTC on 10 October: guaranteed to the 13th, deadline 22:59 UTC on the 24th. */
function heldDeliverable(): MoneyState {
  return after(authorizing(), answered("held"));
}

/** A held deliverable whose draft is cleared to publish. */
function readyToPublish(): MoneyState {
  return after(heldDeliverable(), { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") });
}

const askGoAhead = (time: string, confirmId = "conf_1"): MoneyEvent => ({
  type: "go_ahead_requested",
  confirmId,
  at: at(time),
});

describe("MP-FR-10 asking for the go-ahead", () => {
  test("is refused before the deliverable is held", () => {
    expect(transition(agreedDeliverable(), askGoAhead("2026-10-10T13:00:00Z"))).toEqual({
      ok: false,
      reason: "not_held",
    });
  });

  test("is refused until the draft is cleared to publish", () => {
    expect(transition(heldDeliverable(), askGoAhead("2026-10-10T13:00:00Z"))).toEqual({
      ok: false,
      reason: "draft_not_cleared",
    });
  });

  test("is refused once the deadline has passed", () => {
    expect(transition(readyToPublish(), askGoAhead("2026-10-24T23:00:00Z"))).toEqual({
      ok: false,
      reason: "deadline_passed",
    });
  });
});

describe("MP-FR-11 inside the guarantee", () => {
  const asked = () => after(readyToPublish(), askGoAhead("2026-10-10T13:00:00Z"));

  test("re-confirming asks PayPal whether the hold is still in place", () => {
    expect(transition(readyToPublish(), askGoAhead("2026-10-10T13:00:00Z"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "confirming", confirmId: "conf_1" } },
      effects: [{ type: "check_hold", confirmId: "conf_1", reference: "AUTH-1" }],
    });
  });

  test("a hold still in place gives the go-ahead, and its end is scheduled", () => {
    // The guarantee ends at 09:05:10 on the 13th, so the go-ahead stops 24 hours before that (MP-FR-13).
    expect(
      transition(asked(), { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T13:00:05Z") }),
    ).toMatchObject({
      ok: true,
      state: {
        goAhead: { status: "running", until: at("2026-10-12T09:05:10Z") },
        hold: { reference: "AUTH-1", guaranteeEndsAt: at("2026-10-13T09:05:10Z") },
      },
      effects: [{ type: "schedule_job", job: "go_ahead_ends", at: at("2026-10-12T09:05:10Z") }],
    });
  });

  test("asking again while PayPal is being asked, or while a go-ahead is running, changes nothing", () => {
    const confirming = asked();
    const running = after(confirming, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T13:00:05Z") });

    expect(transition(confirming, askGoAhead("2026-10-10T13:00:02Z", "conf_2"))).toEqual({
      ok: true,
      state: confirming,
      effects: [],
    });
    expect(transition(running, askGoAhead("2026-10-10T14:00:00Z", "conf_2"))).toEqual({
      ok: true,
      state: running,
      effects: [],
    });
  });
});

describe("MP-FR-12 after the guarantee", () => {
  test("re-confirming asks PayPal to renew the hold", () => {
    expect(transition(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"))).toMatchObject({
      ok: true,
      effects: [{ type: "renew_hold", confirmId: "conf_1", reference: "AUTH-1" }],
    });
  });

  test("a renewed hold records the new reference, a new 3-day guarantee and a 48-hour go-ahead", () => {
    const asked = after(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"));

    expect(
      transition(asked, {
        type: "hold_confirmed",
        confirmId: "conf_1",
        renewedReference: "AUTH-2",
        at: at("2026-10-15T10:00:05Z"),
      }),
    ).toMatchObject({
      ok: true,
      state: {
        hold: { reference: "AUTH-2", guaranteeEndsAt: at("2026-10-18T10:00:05Z") },
        goAhead: { status: "running", until: at("2026-10-17T10:00:05Z") },
      },
      effects: [{ type: "schedule_job", job: "go_ahead_ends", at: at("2026-10-17T10:00:05Z") }],
    });
  });
});

describe("MP-FR-13 how long a go-ahead lasts", () => {
  test("it never runs past the deadline", () => {
    // The deadline is 22:59 UTC on the 24th. A hold renewed the evening before would otherwise run to the 25th.
    const asked = after(readyToPublish(), askGoAhead("2026-10-23T20:00:00Z"));

    expect(
      transition(asked, {
        type: "hold_confirmed",
        confirmId: "conf_1",
        renewedReference: "AUTH-2",
        at: at("2026-10-23T20:00:05Z"),
      }),
    ).toMatchObject({ ok: true, state: { goAhead: { status: "running", until: at("2026-10-24T22:59:00Z") } } });
  });

  test("with under 24 hours of guarantee left, the answer is to wait until it can be renewed", () => {
    // The guarantee ends at 09:05:10 on the 13th. PayPal is not asked: the answer would not help.
    expect(transition(readyToPublish(), askGoAhead("2026-10-12T10:00:00Z"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "wait_until", until: at("2026-10-13T09:05:10Z") } },
      effects: [],
    });
  });

  test("a confirmation that arrives with under 24 hours of guarantee left also says to wait", () => {
    const asked = after(readyToPublish(), askGoAhead("2026-10-12T09:05:00Z"));

    expect(
      transition(asked, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-12T09:05:20Z") }),
    ).toMatchObject({
      ok: true,
      state: { goAhead: { status: "wait_until", until: at("2026-10-13T09:05:10Z") } },
      effects: [],
    });
  });

  test("after waiting, the creator can ask again and the hold is renewed", () => {
    const waiting = after(readyToPublish(), askGoAhead("2026-10-12T10:00:00Z"));

    expect(transition(waiting, askGoAhead("2026-10-13T09:06:00Z", "conf_2"))).toMatchObject({
      ok: true,
      effects: [{ type: "renew_hold", confirmId: "conf_2" }],
    });
  });
});

describe("MP-FR-14 not confirmed", () => {
  const notConfirmed = () =>
    after(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"), {
      type: "hold_not_confirmed",
      confirmId: "conf_1",
      at: at("2026-10-15T10:00:05Z"),
    });

  test("no go-ahead is given, the hold stays, and the brand is told", () => {
    const asked = after(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"));

    expect(
      transition(asked, { type: "hold_not_confirmed", confirmId: "conf_1", at: at("2026-10-15T10:00:05Z") }),
    ).toMatchObject({
      ok: true,
      state: { stage: "held", hold: { reference: "AUTH-1" }, goAhead: { status: "not_confirmed" } },
      effects: [{ type: "notify", to: "brand", about: "hold_not_confirmed" }],
    });
  });

  test("the creator can ask again", () => {
    expect(transition(notConfirmed(), askGoAhead("2026-10-16T10:00:00Z", "conf_2"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "confirming", confirmId: "conf_2" } },
      effects: [{ type: "renew_hold", confirmId: "conf_2", reference: "AUTH-1" }],
    });
  });
});

describe("MP-FR-15 when a go-ahead runs out", () => {
  // Renewed at 10:00:05 on the 15th, so the go-ahead runs to 10:00:05 on the 17th.
  const running = () =>
    after(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"), {
      type: "hold_confirmed",
      confirmId: "conf_1",
      renewedReference: "AUTH-2",
      at: at("2026-10-15T10:00:05Z"),
    });
  const endsDue = (publishedAt: string | null, time = "2026-10-17T10:00:05Z"): MoneyEvent => ({
    type: "go_ahead_ends_due",
    publishedAt: publishedAt ? at(publishedAt) : null,
    at: at(time),
  });

  test("with no post published, the go-ahead ends and the creator must ask again", () => {
    const ended = after(running(), endsDue(null));

    expect(ended).toMatchObject({ stage: "held", goAhead: { status: "none" }, publishedAt: null });
    // The renewed guarantee has 24 hours left, which is inside the margin, and PayPal cannot renew it yet (MP-FR-13).
    expect(transition(ended, askGoAhead("2026-10-17T11:00:00Z", "conf_2"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "wait_until", until: at("2026-10-18T10:00:05Z") } },
    });
    expect(transition(ended, askGoAhead("2026-10-18T10:01:00Z", "conf_2"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "confirming", confirmId: "conf_2" } },
      effects: [{ type: "renew_hold", confirmId: "conf_2" }],
    });
  });

  test("with a post published, the go-ahead is kept and the publication recorded", () => {
    const before = running();

    expect(transition(before, endsDue("2026-10-17T09:30:00Z"))).toEqual({
      ok: true,
      state: { ...before, publishedAt: at("2026-10-17T09:30:00Z") },
      effects: [],
    });
  });

  test("a late job from an earlier go-ahead does not end the current one", () => {
    const before = running();

    expect(transition(before, endsDue(null, "2026-10-16T08:00:00Z"))).toEqual({
      ok: true,
      state: before,
      effects: [],
    });
  });

  test("it does nothing when no go-ahead is running", () => {
    const before = readyToPublish();

    expect(transition(before, endsDue(null))).toEqual({ ok: true, state: before, effects: [] });
  });
});

describe("MP-FR-13 a deadline inside the guarantee (revision 1.1)", () => {
  // A 2-day deadline: held at 09:05:10 on the 10th, deadline 22:59 UTC on the 12th, guaranteed to 09:05:10 on the 13th.
  const shortDeadline = () =>
    after(authorizing({ deadlineDays: 2 }), answered("held"), { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") });

  test("asking in the last hours before the deadline checks the hold, and is not told to wait", () => {
    expect(transition(shortDeadline(), askGoAhead("2026-10-12T10:00:00Z"))).toMatchObject({
      ok: true,
      state: { goAhead: { status: "confirming" } },
      effects: [{ type: "check_hold", confirmId: "conf_1", reference: "AUTH-1" }],
    });
  });

  test("the go-ahead runs to the deadline, with no 24-hour margin", () => {
    const asked = after(shortDeadline(), askGoAhead("2026-10-12T10:00:00Z"));

    expect(
      transition(asked, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-12T10:00:05Z") }),
    ).toMatchObject({
      ok: true,
      state: { goAhead: { status: "running", until: at("2026-10-12T22:59:00Z") } },
      effects: [{ type: "schedule_job", job: "go_ahead_ends", at: at("2026-10-12T22:59:00Z") }],
    });
  });

  test("asked early, it still lasts no more than 48 hours", () => {
    // A 3-day deadline for a creator in Los Angeles: held 09:05:10 UTC on the 10th, guaranteed to 09:05:10 on the
    // 13th, deadline 06:59 UTC on the 14th. That deadline is outside the guarantee, so the margin applies as before.
    const asked = after(
      authorizing({ deadlineDays: 3, creatorTimeZone: "America/Los_Angeles" }),
      answered("held"),
      { type: "draft_cleared", at: at("2026-10-10T09:10:00Z") },
      askGoAhead("2026-10-10T09:10:00Z"),
    );

    expect(
      transition(asked, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T09:10:05Z") }),
    ).toMatchObject({ ok: true, state: { goAhead: { status: "running", until: at("2026-10-12T09:05:10Z") } } });
  });

  test("with a 1-day deadline it runs to the deadline, well inside 48 hours", () => {
    const asked = after(
      authorizing({ deadlineDays: 1 }),
      answered("held"),
      { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") },
      askGoAhead("2026-10-10T12:00:00Z"),
    );

    expect(
      transition(asked, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T12:00:05Z") }),
    ).toMatchObject({ ok: true, state: { goAhead: { status: "running", until: at("2026-10-11T22:59:00Z") } } });
  });
});

/** A held deliverable whose approved post went live at 09:30 UTC on 17 October, a week before the deadline. */
function published(): MoneyState {
  return after(readyToPublish(), {
    type: "post_published",
    publishedAt: at("2026-10-17T09:30:00Z"),
    at: at("2026-10-17T09:35:00Z"),
  });
}

const liveCheck = (
  result: "passed" | "cannot_decide" | "failed_fixable" | "failed_not_fixable",
  time = "2026-10-17T09:40:00Z",
): MoneyEvent => ({ type: "live_check_result", result, at: at(time) });

describe("MP-FR-16 published", () => {
  test("records when the approved post was published", () => {
    expect(published()).toMatchObject({ stage: "held", publishedAt: at("2026-10-17T09:30:00Z") });
  });

  test("a second report does not move the publish time", () => {
    const before = published();

    expect(
      transition(before, { type: "post_published", publishedAt: at("2026-10-18T00:00:00Z"), at: at("2026-10-18T00:05:00Z") }),
    ).toEqual({ ok: true, state: before, effects: [] });
  });

  test("is refused for a deliverable that is not held", () => {
    expect(
      transition(agreedDeliverable(), { type: "post_published", publishedAt: at("2026-10-17T09:30:00Z"), at: at("2026-10-17T09:35:00Z") }),
    ).toEqual({ ok: false, reason: "not_held" });
  });
});

describe("MP-FR-17 live check passed", () => {
  test("the approval is put on record and the capture is started", () => {
    expect(transition(published(), liveCheck("passed"))).toMatchObject({
      ok: true,
      state: { stage: "held", approval: { by: "live_check", at: at("2026-10-17T09:40:00Z") } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("a result for a post that was never reported published is refused", () => {
    expect(transition(readyToPublish(), liveCheck("passed"))).toEqual({ ok: false, reason: "not_published" });
  });

  test("a second passing result does not start a second capture (MP-BR-03)", () => {
    const approved = after(published(), liveCheck("passed"));

    expect(transition(approved, liveCheck("passed", "2026-10-17T10:00:00Z"))).toEqual({
      ok: true,
      state: approved,
      effects: [],
    });
  });
});

describe("MP-FR-18 live check cannot decide", () => {
  const undecided = () => after(published(), liveCheck("cannot_decide"));
  const silence = (time: string): MoneyEvent => ({ type: "brand_confirm_ends_due", at: at(time) });

  test("the brand gets 48 hours to confirm or object, and is told", () => {
    expect(transition(published(), liveCheck("cannot_decide"))).toMatchObject({
      ok: true,
      state: { approval: null, waitingOn: { for: "brand_to_confirm", until: at("2026-10-19T09:40:00Z") } },
      effects: [
        { type: "schedule_job", job: "brand_confirm_ends", at: at("2026-10-19T09:40:00Z") },
        { type: "notify", to: "brand", about: "confirm_live_post" },
      ],
    });
  });

  test("confirming captures the hold", () => {
    expect(transition(undecided(), { type: "brand_confirmed", at: at("2026-10-18T08:00:00Z") })).toMatchObject({
      ok: true,
      state: { waitingOn: null, approval: { by: "brand_confirmed", at: at("2026-10-18T08:00:00Z") } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("48 hours of silence captures the hold", () => {
    expect(transition(undecided(), silence("2026-10-19T09:40:00Z"))).toMatchObject({
      ok: true,
      state: { waitingOn: null, approval: { by: "brand_silence", at: at("2026-10-19T09:40:00Z") } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("the silence timer does nothing early, or once the brand has answered", () => {
    const waiting = undecided();
    const confirmed = after(waiting, { type: "brand_confirmed", at: at("2026-10-18T08:00:00Z") });

    expect(transition(waiting, silence("2026-10-19T09:00:00Z"))).toEqual({ ok: true, state: waiting, effects: [] });
    expect(transition(confirmed, silence("2026-10-19T09:40:00Z"))).toEqual({ ok: true, state: confirmed, effects: [] });
  });

  test("an objection goes to a person at Cleared, and silence no longer pays", () => {
    const objection: MoneyEvent = { type: "brand_objected", reason: "The link goes to the wrong page.", at: at("2026-10-18T08:00:00Z") };
    const objected = after(undecided(), objection);

    expect(transition(undecided(), objection)).toMatchObject({
      ok: true,
      state: { approval: null, waitingOn: { for: "cleared_to_rule", objection: "The link goes to the wrong page." } },
      effects: [{ type: "notify", to: "cleared", about: "brand_objected" }],
    });
    expect(transition(objected, silence("2026-10-19T09:40:00Z"))).toEqual({ ok: true, state: objected, effects: [] });
  });

  test("confirming or objecting is refused when the brand has not been asked", () => {
    expect(transition(published(), { type: "brand_confirmed", at: at("2026-10-18T08:00:00Z") })).toEqual({
      ok: false,
      reason: "nothing_to_confirm",
    });
    expect(
      transition(published(), { type: "brand_objected", reason: "No.", at: at("2026-10-18T08:00:00Z") }),
    ).toEqual({ ok: false, reason: "nothing_to_confirm" });
  });
});

describe("MP-FR-19 Cleared's ruling", () => {
  const objected = () =>
    after(published(), liveCheck("cannot_decide"), {
      type: "brand_objected",
      reason: "The link goes to the wrong page.",
      at: at("2026-10-18T08:00:00Z"),
    });

  test("a ruling to pay captures the hold", () => {
    expect(transition(objected(), { type: "cleared_ruled", decision: "pay", at: at("2026-10-20T10:00:00Z") })).toMatchObject({
      ok: true,
      state: { stage: "held", waitingOn: null, approval: { by: "cleared", at: at("2026-10-20T10:00:00Z") } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("a ruling not to pay releases the hold", () => {
    expect(
      transition(objected(), { type: "cleared_ruled", decision: "release", at: at("2026-10-20T10:00:00Z") }),
    ).toMatchObject({
      ok: true,
      state: {
        stage: "released",
        waitingOn: null,
        approval: null,
        release: { reason: "cleared_ruled", at: at("2026-10-20T10:00:00Z") },
      },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("a ruling is refused when nothing is waiting on Cleared", () => {
    expect(transition(published(), { type: "cleared_ruled", decision: "pay", at: at("2026-10-20T10:00:00Z") })).toEqual({
      ok: false,
      reason: "nothing_to_rule_on",
    });
  });
});

describe("MP-FR-20 live check failed, fixable", () => {
  const windowEnds = (time: string): MoneyEvent => ({ type: "fix_window_ends_due", at: at(time) });

  test("the creator has until the deadline to fix it, and is told", () => {
    // Failed on the 17th; the deadline is 22:59 UTC on the 24th, which is later than 24 hours on.
    expect(transition(published(), liveCheck("failed_fixable"))).toMatchObject({
      ok: true,
      state: { stage: "held", approval: null, waitingOn: { for: "creator_to_fix", until: at("2026-10-24T22:59:00Z") } },
      effects: [
        { type: "schedule_job", job: "fix_window_ends", at: at("2026-10-24T22:59:00Z") },
        { type: "notify", to: "creator", about: "fix_live_post" },
      ],
    });
  });

  test("a failure reported near the deadline still leaves 24 hours", () => {
    expect(transition(published(), liveCheck("failed_fixable", "2026-10-24T20:00:00Z"))).toMatchObject({
      ok: true,
      state: { waitingOn: { for: "creator_to_fix", until: at("2026-10-25T20:00:00Z") } },
    });
  });

  test("failing again inside the window does not extend it", () => {
    const fixing = after(published(), liveCheck("failed_fixable", "2026-10-24T20:00:00Z"));

    expect(transition(fixing, liveCheck("failed_fixable", "2026-10-25T10:00:00Z"))).toEqual({
      ok: true,
      state: fixing,
      effects: [],
    });
  });

  test("a pass inside the window captures the hold", () => {
    const fixing = after(published(), liveCheck("failed_fixable"));

    expect(transition(fixing, liveCheck("passed", "2026-10-18T09:00:00Z"))).toMatchObject({
      ok: true,
      state: { waitingOn: null, approval: { by: "live_check" } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("a check that then cannot decide goes to the brand", () => {
    const fixing = after(published(), liveCheck("failed_fixable"));

    expect(transition(fixing, liveCheck("cannot_decide", "2026-10-18T09:00:00Z"))).toMatchObject({
      ok: true,
      state: { waitingOn: { for: "brand_to_confirm", until: at("2026-10-20T09:00:00Z") } },
    });
  });

  test("still failing when the window ends, the hold is released", () => {
    const fixing = after(published(), liveCheck("failed_fixable"));

    expect(transition(fixing, windowEnds("2026-10-24T22:59:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "fix_window_ended", at: at("2026-10-24T22:59:00Z") } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("the window's end does nothing early, or once the post has passed", () => {
    const fixing = after(published(), liveCheck("failed_fixable"));
    const passed = after(fixing, liveCheck("passed", "2026-10-18T09:00:00Z"));

    expect(transition(fixing, windowEnds("2026-10-24T22:00:00Z"))).toEqual({ ok: true, state: fixing, effects: [] });
    expect(transition(passed, windowEnds("2026-10-24T22:59:00Z"))).toEqual({ ok: true, state: passed, effects: [] });
  });
});

describe("MP-FR-21 live check failed, not fixable", () => {
  const failed = () => after(published(), liveCheck("failed_not_fixable"));

  test("the brand gets 48 hours to accept the post anyway, and is told", () => {
    expect(transition(published(), liveCheck("failed_not_fixable"))).toMatchObject({
      ok: true,
      state: { approval: null, waitingOn: { for: "brand_to_accept", until: at("2026-10-19T09:40:00Z") } },
      effects: [
        { type: "schedule_job", job: "brand_accept_ends", at: at("2026-10-19T09:40:00Z") },
        { type: "notify", to: "brand", about: "accept_failed_post" },
      ],
    });
  });

  test("accepting captures the hold", () => {
    expect(transition(failed(), { type: "brand_accepted", at: at("2026-10-18T08:00:00Z") })).toMatchObject({
      ok: true,
      state: { waitingOn: null, approval: { by: "brand_accepted", at: at("2026-10-18T08:00:00Z") } },
      effects: [{ type: "start_capture" }],
    });
  });

  test("silence does not pay: after 48 hours the hold is released", () => {
    expect(transition(failed(), { type: "brand_accept_ends_due", at: at("2026-10-19T09:40:00Z") })).toMatchObject({
      ok: true,
      state: { stage: "released", approval: null, release: { reason: "not_accepted" } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("accepting is refused when the brand has not been asked", () => {
    expect(transition(published(), { type: "brand_accepted", at: at("2026-10-18T08:00:00Z") })).toEqual({
      ok: false,
      reason: "nothing_to_accept",
    });
  });

  test("the brand cannot confirm its way past a failed post", () => {
    expect(transition(failed(), { type: "brand_confirmed", at: at("2026-10-18T08:00:00Z") })).toEqual({
      ok: false,
      reason: "nothing_to_confirm",
    });
  });
});

describe("MP-FR-22 the deadline", () => {
  // The deadline is 22:59 UTC on 24 October.
  const deadlineDue = (publishedAt: string | null, time = "2026-10-24T22:59:00Z"): MoneyEvent => ({
    type: "deadline_due",
    publishedAt: publishedAt ? at(publishedAt) : null,
    at: at(time),
  });

  test("with no approved post published in time, the hold is released", () => {
    expect(transition(readyToPublish(), deadlineDue(null))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "deadline", at: at("2026-10-24T22:59:00Z") } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("a post already recorded as published in time keeps its hold", () => {
    const before = published();

    expect(transition(before, deadlineDue(null))).toEqual({ ok: true, state: before, effects: [] });
  });

  test("a post the live check finds was published in time keeps its hold, and is recorded", () => {
    const before = readyToPublish();

    expect(transition(before, deadlineDue("2026-10-24T22:50:00Z"))).toEqual({
      ok: true,
      state: { ...before, publishedAt: at("2026-10-24T22:50:00Z") },
      effects: [],
    });
  });

  test("a post published after the deadline does not keep the hold", () => {
    expect(transition(readyToPublish(), deadlineDue("2026-10-24T23:10:00Z", "2026-10-24T23:15:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "deadline" } },
    });
  });

  test("when the last go-ahead request was not confirmed, the reason says so", () => {
    const notConfirmed = after(readyToPublish(), askGoAhead("2026-10-23T10:00:00Z"), {
      type: "hold_not_confirmed",
      confirmId: "conf_1",
      at: at("2026-10-23T10:00:05Z"),
    });

    expect(transition(notConfirmed, deadlineDue(null))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "hold_not_confirmed" } },
    });
  });

  test("it does nothing before the deadline, or for a deliverable that is not held", () => {
    const held = readyToPublish();
    const notHeld = agreedDeliverable();

    expect(transition(held, deadlineDue(null, "2026-10-24T22:00:00Z"))).toEqual({ ok: true, state: held, effects: [] });
    expect(transition(notHeld, deadlineDue(null))).toEqual({ ok: true, state: notHeld, effects: [] });
  });
});

describe("MP-FR-23 day 28", () => {
  // Day 28 is 09:05:10 UTC on 7 November.
  const day28Due = (time = "2026-11-07T09:05:10Z"): MoneyEvent => ({ type: "day_28_due", at: at(time) });
  const withCleared = () =>
    after(published(), liveCheck("cannot_decide"), {
      type: "brand_objected",
      reason: "The link goes to the wrong page.",
      at: at("2026-10-18T08:00:00Z"),
    });

  test("a hold still undecided is released", () => {
    expect(transition(withCleared(), day28Due())).toMatchObject({
      ok: true,
      state: { stage: "released", waitingOn: null, release: { reason: "day_28", at: at("2026-11-07T09:05:10Z") } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("a hold approved to pay but never captured ends as approved, not paid", () => {
    const approved = after(published(), liveCheck("passed"));

    expect(transition(approved, day28Due())).toMatchObject({
      ok: true,
      state: { stage: "approved_not_paid", approval: { by: "live_check" }, release: { reason: "day_28" } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("it does nothing early", () => {
    const before = withCleared();

    expect(transition(before, day28Due("2026-11-07T09:00:00Z"))).toEqual({ ok: true, state: before, effects: [] });
  });
});

describe("MP-BR-08 a finished deliverable", () => {
  const released = () =>
    after(readyToPublish(), askGoAhead("2026-10-23T10:00:00Z"), {
      type: "deadline_due",
      publishedAt: null,
      at: at("2026-10-24T22:59:00Z"),
    });

  test.each<[string, MoneyEvent]>([
    ["starting a new hold", startAgain],
    ["asking for the go-ahead", askGoAhead("2026-10-25T10:00:00Z", "conf_2")],
    ["reporting a post published", { type: "post_published", publishedAt: at("2026-10-25T10:00:00Z"), at: at("2026-10-25T10:05:00Z") }],
    ["a live check result", liveCheck("passed", "2026-10-25T10:10:00Z")],
    ["the brand confirming", { type: "brand_confirmed", at: at("2026-10-25T10:10:00Z") }],
    ["Cleared ruling", { type: "cleared_ruled", decision: "pay", at: at("2026-10-25T10:10:00Z") }],
  ])("refuses %s after release", (_, event) => {
    expect(transition(released(), event)).toEqual({ ok: false, reason: "finished" });
  });

  test.each<[string, MoneyEvent]>([
    ["a late answer from PayPal", { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-24T23:05:00Z") }],
    ["day 28", { type: "day_28_due", at: at("2026-11-07T09:05:10Z") }],
    ["a second deadline job", { type: "deadline_due", publishedAt: null, at: at("2026-10-24T23:30:00Z") }],
  ])("%s changes nothing after release", (_, event) => {
    const before = released();

    expect(transition(before, event)).toEqual({ ok: true, state: before, effects: [] });
  });
});

/** A published deliverable whose live check passed at 09:40 UTC on 17 October: approved to pay, not yet captured. */
function approvedToPay(terms: Partial<MoneyTerms> = {}): MoneyState {
  return after(
    authorizing(terms),
    answered("held"),
    { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") },
    { type: "post_published", publishedAt: at("2026-10-17T09:30:00Z"), at: at("2026-10-17T09:35:00Z") },
    liveCheck("passed"),
  );
}

const captureStarted = (captureId = "cap_1", time = "2026-10-17T09:40:01Z"): MoneyEvent => ({
  type: "capture_started",
  captureId,
  at: at(time),
});

describe("MP-FR-24 capture", () => {
  test("an approved hold is captured in full", () => {
    expect(transition(approvedToPay({ amountCents: 120_000 }), captureStarted())).toMatchObject({
      ok: true,
      state: { stage: "held", capture: { id: "cap_1", status: "started" } },
      effects: [{ type: "capture_hold", captureId: "cap_1", reference: "AUTH-1", amountCents: 120_000 }],
    });
  });

  test("a capture is refused without an approval on record (MP-BR-04)", () => {
    expect(transition(published(), captureStarted())).toEqual({ ok: false, reason: "not_approved" });
  });

  test("a second capture is never started while one is unanswered (MP-FR-26)", () => {
    const capturing = after(approvedToPay(), captureStarted());

    expect(transition(capturing, captureStarted("cap_2", "2026-10-17T09:41:00Z"))).toEqual({
      ok: true,
      state: capturing,
      effects: [],
    });
  });

  test("a completed capture records the reference and starts the payout", () => {
    const capturing = after(approvedToPay({ amountCents: 120_000 }), captureStarted());

    expect(
      transition(capturing, {
        type: "capture_answered",
        captureId: "cap_1",
        outcome: "completed",
        reference: "CAPTURE-1",
        at: at("2026-10-17T09:40:05Z"),
      }),
    ).toMatchObject({
      ok: true,
      state: {
        stage: "captured",
        capture: { id: "cap_1", status: "completed", reference: "CAPTURE-1", at: at("2026-10-17T09:40:05Z") },
      },
      effects: [{ type: "start_payout" }],
    });
  });
});

describe("MP-FR-27 the fee", () => {
  const captured = (amountCents: number) =>
    after(approvedToPay({ amountCents }), captureStarted(), {
      type: "capture_answered",
      captureId: "cap_1",
      outcome: "completed",
      reference: "CAPTURE-1",
      at: at("2026-10-17T09:40:05Z"),
    });

  test("a $1,200.00 post keeps a $60.00 fee and pays the creator $1,140.00", () => {
    expect(captured(120_000)).toMatchObject({ feeCents: 6_000, payoutCents: 114_000 });
  });

  test("the fee is rounded down to the cent, in the creator's favour", () => {
    // 5% of $33.33 is $1.6665.
    expect(captured(3_333)).toMatchObject({ feeCents: 166, payoutCents: 3_167 });
  });

  test("the fee and the payout always add up to the amount held", () => {
    for (const amountCents of [2_000, 2_001, 9_999, 33_333, 999_999, 1_000_000]) {
      const state = captured(amountCents);
      expect((state.feeCents ?? 0) + (state.payoutCents ?? 0)).toBe(amountCents);
    }
  });
});

describe("MP-FR-25 capture refused", () => {
  const refusedAt = (time: string, captureId = "cap_1"): MoneyEvent => ({
    type: "capture_answered",
    captureId,
    outcome: "refused",
    at: at(time),
  });
  const retryDue = (time: string, captureId = "cap_2"): MoneyEvent => ({ type: "capture_retry_due", captureId, at: at(time) });
  const refused = () => after(approvedToPay(), captureStarted(), refusedAt("2026-10-17T09:40:05Z"));

  test("a refusal schedules another try in 6 hours and tells both sides", () => {
    expect(transition(after(approvedToPay(), captureStarted()), refusedAt("2026-10-17T09:40:05Z"))).toMatchObject({
      ok: true,
      state: { stage: "held", capture: { id: "cap_1", status: "refused" } },
      effects: [
        { type: "schedule_job", job: "capture_retry", at: at("2026-10-17T15:40:05Z") },
        { type: "notify", to: "creator", about: "capture_failed" },
        { type: "notify", to: "brand", about: "payment_failed" },
      ],
    });
  });

  test("the next try re-confirms the hold first when its guarantee has ended", () => {
    // Held on the 10th and never renewed, so the guarantee ended on the 13th.
    expect(transition(refused(), retryDue("2026-10-17T15:40:05Z"))).toMatchObject({
      ok: true,
      state: { capture: { id: "cap_2", status: "started" } },
      effects: [{ type: "capture_hold", captureId: "cap_2", reference: "AUTH-1", amountCents: 120_000, renewFirst: true }],
    });
  });

  test("the next try does not re-confirm a hold that is still guaranteed", () => {
    // Renewed at 10:00:05 on the 15th, so guaranteed to the 18th.
    const state = after(
      readyToPublish(),
      askGoAhead("2026-10-15T10:00:00Z"),
      { type: "hold_confirmed", confirmId: "conf_1", renewedReference: "AUTH-2", at: at("2026-10-15T10:00:05Z") },
      { type: "post_published", publishedAt: at("2026-10-16T09:00:00Z"), at: at("2026-10-16T09:05:00Z") },
      liveCheck("passed", "2026-10-16T09:10:00Z"),
      captureStarted("cap_1", "2026-10-16T09:10:01Z"),
      refusedAt("2026-10-16T09:10:05Z"),
    );

    expect(transition(state, retryDue("2026-10-16T15:10:05Z"))).toMatchObject({
      ok: true,
      effects: [{ type: "capture_hold", captureId: "cap_2", reference: "AUTH-2", renewFirst: false }],
    });
  });

  test("a hold renewed during a try keeps its new reference and guarantee", () => {
    const retrying = after(refused(), retryDue("2026-10-17T15:40:05Z"));

    expect(
      transition(retrying, {
        type: "capture_answered",
        captureId: "cap_2",
        outcome: "refused",
        renewedReference: "AUTH-2",
        at: at("2026-10-17T15:40:10Z"),
      }),
    ).toMatchObject({
      ok: true,
      state: { hold: { reference: "AUTH-2", guaranteeEndsAt: at("2026-10-20T15:40:10Z") }, capture: { status: "refused" } },
    });
  });

  test("a second refusal schedules another try without telling both sides again", () => {
    const retrying = after(refused(), retryDue("2026-10-17T15:40:05Z"));

    expect(transition(retrying, refusedAt("2026-10-17T15:40:10Z", "cap_2"))).toMatchObject({
      ok: true,
      effects: [{ type: "schedule_job", job: "capture_retry", at: at("2026-10-17T21:40:10Z") }],
    });
    expect(transition(retrying, refusedAt("2026-10-17T15:40:10Z", "cap_2"))).toMatchObject({
      effects: expect.not.arrayContaining([expect.objectContaining({ type: "notify" })]),
    });
  });

  test("a retry that succeeds captures the hold", () => {
    const retrying = after(refused(), retryDue("2026-10-17T15:40:05Z"));

    expect(
      transition(retrying, {
        type: "capture_answered",
        captureId: "cap_2",
        outcome: "completed",
        reference: "CAPTURE-2",
        at: at("2026-10-17T15:40:10Z"),
      }),
    ).toMatchObject({ ok: true, state: { stage: "captured", capture: { reference: "CAPTURE-2" } } });
  });

  test("the retry job does nothing on day 28 or later, or when no refusal is waiting", () => {
    const waiting = refused();
    const capturing = after(approvedToPay(), captureStarted());

    expect(transition(waiting, retryDue("2026-11-07T09:05:10Z"))).toEqual({ ok: true, state: waiting, effects: [] });
    expect(transition(capturing, retryDue("2026-10-17T15:40:05Z"))).toEqual({ ok: true, state: capturing, effects: [] });
  });

  test("on day 28 a refused capture ends as approved, not paid", () => {
    expect(transition(refused(), { type: "day_28_due", at: at("2026-11-07T09:05:10Z") })).toMatchObject({
      ok: true,
      state: { stage: "approved_not_paid", release: { reason: "day_28" } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });
});

describe("MP-FR-26 capture not answered", () => {
  const unanswered = () =>
    after(approvedToPay(), captureStarted(), {
      type: "capture_answered",
      captureId: "cap_1",
      outcome: "unknown",
      at: at("2026-10-17T09:40:30Z"),
    });

  test("an unclear answer is followed up with PayPal, not retried as a new capture", () => {
    const capturing = after(approvedToPay(), captureStarted());

    expect(
      transition(capturing, { type: "capture_answered", captureId: "cap_1", outcome: "unknown", at: at("2026-10-17T09:40:30Z") }),
    ).toEqual({ ok: true, state: capturing, effects: [{ type: "check_capture", captureId: "cap_1" }] });
  });

  test("the real answer settles it later", () => {
    expect(
      transition(unanswered(), {
        type: "capture_answered",
        captureId: "cap_1",
        outcome: "completed",
        reference: "CAPTURE-1",
        at: at("2026-10-17T10:00:00Z"),
      }),
    ).toMatchObject({ ok: true, state: { stage: "captured" } });
  });

  test("day 28 waits while a capture is unanswered, so a hold is never released under a capture", () => {
    expect(transition(unanswered(), { type: "day_28_due", at: at("2026-11-07T09:05:10Z") })).toEqual({
      ok: false,
      reason: "capture_in_progress",
    });
  });
});

/** A $1,200.00 deliverable captured at 09:40:05 UTC on 17 October; the creator is owed $1,140.00. */
function captured(): MoneyState {
  return after(approvedToPay({ amountCents: 120_000 }), captureStarted(), {
    type: "capture_answered",
    captureId: "cap_1",
    outcome: "completed",
    reference: "CAPTURE-1",
    at: at("2026-10-17T09:40:05Z"),
  });
}

const payoutStarted = (payoutId = "pay_1", time = "2026-10-17T09:40:06Z"): MoneyEvent => ({
  type: "payout_started",
  payoutId,
  at: at(time),
});

type PayoutOutcome = "unclaimed" | "failed" | "returned" | "blocked" | "denied" | "unknown" | "cancelled";
const payoutAnswered = (outcome: PayoutOutcome, payoutId = "pay_1", time = "2026-10-17T09:45:00Z"): MoneyEvent => ({
  type: "payout_answered",
  payoutId,
  outcome,
  at: at(time),
});
const payoutSucceeded = (payoutId = "pay_1", time = "2026-10-17T09:45:00Z"): MoneyEvent => ({
  type: "payout_answered",
  payoutId,
  outcome: "succeeded",
  reference: "PAYOUT-1",
  at: at(time),
});

describe("MP-FR-28 payout", () => {
  test("a completed capture pays out the amount less the fee", () => {
    expect(transition(captured(), payoutStarted())).toMatchObject({
      ok: true,
      state: { stage: "captured", payout: { id: "pay_1", status: "sending" } },
      effects: [{ type: "send_payout", payoutId: "pay_1", amountCents: 114_000 }],
    });
  });

  test("a payout is refused without a completed capture (MP-BR-04)", () => {
    expect(transition(approvedToPay(), payoutStarted())).toEqual({ ok: false, reason: "not_captured" });
  });

  test("a second payout is never started beside the first (MP-BR-04)", () => {
    const sending = after(captured(), payoutStarted());

    expect(transition(sending, payoutStarted("pay_2"))).toEqual({ ok: true, state: sending, effects: [] });
  });
});

describe("MP-FR-29 payout results", () => {
  const sending = () => after(captured(), payoutStarted());

  test("paid only when PayPal reports the payout succeeded (MP-FR-31)", () => {
    expect(transition(sending(), payoutSucceeded())).toMatchObject({
      ok: true,
      state: { stage: "paid", payout: { status: "paid", reference: "PAYOUT-1", at: at("2026-10-17T09:45:00Z") } },
      effects: [],
    });
  });

  test("an unclaimed payout stays captured and the creator is told to accept it", () => {
    expect(transition(sending(), payoutAnswered("unclaimed"))).toMatchObject({
      ok: true,
      state: { stage: "captured", payout: { status: "unclaimed" } },
      effects: [{ type: "notify", to: "creator", about: "payout_unclaimed" }],
    });
  });

  test.each(["failed", "returned", "blocked", "denied"] as const)(
    "a %s payout stays captured and the creator is told to correct their PayPal email",
    (outcome) => {
      expect(transition(sending(), payoutAnswered(outcome))).toMatchObject({
        ok: true,
        state: { stage: "captured", payout: { status: "failed", why: outcome } },
        effects: [{ type: "notify", to: "creator", about: "payout_failed" }],
      });
    },
  );

  test("an unclear answer is followed up with PayPal", () => {
    const before = sending();

    expect(transition(before, payoutAnswered("unknown"))).toEqual({
      ok: true,
      state: before,
      effects: [{ type: "check_payout", payoutId: "pay_1" }],
    });
  });

  test("an unclaimed payout the creator then accepts is paid", () => {
    const unclaimed = after(sending(), payoutAnswered("unclaimed"));

    expect(transition(unclaimed, payoutSucceeded("pay_1", "2026-10-19T12:00:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "paid" },
    });
  });

  test("an unclaimed payout PayPal later returns has failed", () => {
    const unclaimed = after(sending(), payoutAnswered("unclaimed"));

    expect(transition(unclaimed, payoutAnswered("returned", "pay_1", "2026-11-16T09:45:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "captured", payout: { status: "failed", why: "returned" } },
    });
  });

  test("an answer about a payout that is not the current one is refused", () => {
    expect(transition(sending(), payoutSucceeded("pay_other"))).toEqual({ ok: false, reason: "unknown_payout" });
  });
});

describe("MP-FR-30 sending a payout again", () => {
  const retry = (payoutId = "pay_2", time = "2026-10-18T10:00:00Z"): MoneyEvent => ({
    type: "payout_retry_requested",
    payoutId,
    at: at(time),
  });
  const failed = () => after(captured(), payoutStarted(), payoutAnswered("failed"));
  const unclaimed = () => after(captured(), payoutStarted(), payoutAnswered("unclaimed"));

  test("after a failed payout, a new one is sent", () => {
    expect(transition(failed(), retry())).toMatchObject({
      ok: true,
      state: { payout: { id: "pay_2", status: "sending" } },
      effects: [{ type: "send_payout", payoutId: "pay_2", amountCents: 114_000 }],
    });
  });

  test("it is refused while a payout is still being sent", () => {
    expect(transition(after(captured(), payoutStarted()), retry())).toEqual({ ok: false, reason: "payout_in_progress" });
  });

  test("an unclaimed payout is cancelled with PayPal first, and nothing new is sent yet", () => {
    expect(transition(unclaimed(), retry())).toMatchObject({
      ok: true,
      state: { payout: { id: "pay_1", status: "cancelling", nextId: "pay_2" } },
      effects: [{ type: "cancel_payout", payoutId: "pay_1" }],
    });
  });

  test("the new payout is sent only once PayPal confirms the cancellation", () => {
    const cancelling = after(unclaimed(), retry());

    expect(transition(cancelling, payoutAnswered("cancelled", "pay_1", "2026-10-18T10:00:10Z"))).toMatchObject({
      ok: true,
      state: { payout: { id: "pay_2", status: "sending" } },
      effects: [{ type: "send_payout", payoutId: "pay_2", amountCents: 114_000 }],
    });
  });

  test("if the creator accepted the money before the cancellation, it is paid and nothing new is sent", () => {
    const cancelling = after(unclaimed(), retry());

    expect(transition(cancelling, payoutSucceeded("pay_1", "2026-10-18T10:00:10Z"))).toMatchObject({
      ok: true,
      state: { stage: "paid", payout: { id: "pay_1", status: "paid" } },
      effects: [],
    });
  });

  test("it is refused while a cancellation is in flight, and before any capture", () => {
    expect(transition(after(unclaimed(), retry()), retry("pay_3"))).toEqual({ ok: false, reason: "payout_in_progress" });
    expect(transition(approvedToPay(), retry())).toEqual({ ok: false, reason: "not_captured" });
  });
});

describe("MP-FR-31 cleared", () => {
  const paid = () => after(captured(), payoutStarted(), payoutSucceeded());

  test("nothing more can happen to a paid deliverable's money", () => {
    const before = paid();

    expect(transition(before, { type: "payout_retry_requested", payoutId: "pay_2", at: at("2026-10-18T10:00:00Z") })).toEqual({
      ok: false,
      reason: "finished",
    });
    expect(transition(before, payoutAnswered("returned"))).toEqual({ ok: true, state: before, effects: [] });
    expect(transition(before, { type: "day_28_due", at: at("2026-11-07T09:05:10Z") })).toEqual({
      ok: true,
      state: before,
      effects: [],
    });
  });
});

const cancelBy = (by: "creator" | "brand", time = "2026-10-12T10:00:00Z"): MoneyEvent => ({
  type: "cancel_requested",
  by,
  at: at(time),
});

describe("MP-FR-33 cancelling a held deliverable", () => {
  // Renewed at 10:00:05 on the 15th, so the go-ahead runs to 10:00:05 on the 17th.
  const goAheadRunning = () =>
    after(readyToPublish(), askGoAhead("2026-10-15T10:00:00Z"), {
      type: "hold_confirmed",
      confirmId: "conf_1",
      renewedReference: "AUTH-2",
      at: at("2026-10-15T10:00:05Z"),
    });

  test.each(["creator", "brand"] as const)("the %s can cancel, which releases the hold", (by) => {
    expect(transition(heldDeliverable(), cancelBy(by))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "cancelled", by, at: at("2026-10-12T10:00:00Z") } },
      effects: [{ type: "cancel_hold", reference: "AUTH-1" }],
    });
  });

  test("nobody can cancel while a go-ahead is running", () => {
    expect(transition(goAheadRunning(), cancelBy("brand", "2026-10-16T10:00:00Z"))).toEqual({
      ok: false,
      reason: "go_ahead_running",
    });
  });

  test("a go-ahead past its end time still blocks cancelling until it has been checked for a post (MP-FR-15)", () => {
    expect(transition(goAheadRunning(), cancelBy("brand", "2026-10-17T10:00:30Z"))).toEqual({
      ok: false,
      reason: "go_ahead_running",
    });
  });

  test("cancelling is possible again once a go-ahead has ended unused", () => {
    const ended = after(goAheadRunning(), { type: "go_ahead_ends_due", publishedAt: null, at: at("2026-10-17T10:00:05Z") });

    expect(transition(ended, cancelBy("brand", "2026-10-17T10:01:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "cancelled", by: "brand" } },
    });
  });

  test("nobody can cancel once a post is published", () => {
    expect(transition(published(), cancelBy("brand", "2026-10-17T10:00:00Z"))).toEqual({
      ok: false,
      reason: "already_published",
    });
    expect(transition(captured(), cancelBy("creator", "2026-10-17T10:00:00Z"))).toEqual({
      ok: false,
      reason: "already_published",
    });
  });
});

describe("MP-FR-34 cancelling before the hold", () => {
  test("a deliverable that is not held is closed", () => {
    expect(transition(agreedDeliverable(), cancelBy("creator"))).toMatchObject({
      ok: true,
      state: { stage: "closed_not_held", closed: { because: "cancelled", by: "creator", at: at("2026-10-12T10:00:00Z") } },
      effects: [],
    });
  });

  test("an attempt PayPal has not answered is cancelled with PayPal", () => {
    expect(transition(after(authorizing(), answered("pending")), cancelBy("brand"))).toMatchObject({
      ok: true,
      state: { stage: "closed_not_held", attempt: { status: "declined", declinedBecause: "cancelled" } },
      effects: [{ type: "cancel_attempt", attemptId: "att_1", orderId: "ORDER-1" }],
    });
  });

  test("a hold can no longer be started or approved afterwards, and the reason says it was cancelled", () => {
    const cancelled = after(awaitingApproval(), cancelBy("creator"));

    expect(transition(cancelled, startAgain)).toEqual({ ok: false, reason: "cancelled" });
    expect(transition(cancelled, { type: "hold_approved", orderId: "ORDER-1", at: at("2026-10-12T10:05:00Z") })).toEqual({
      ok: false,
      reason: "cancelled",
    });
  });

  test("a deliverable closed as never held says so, not cancelled", () => {
    const neverHeld = after(agreedDeliverable(), { type: "never_held_due", at: at("2026-10-17T08:00:00Z") });

    expect(neverHeld).toMatchObject({ closed: { because: "never_held" } });
    expect(transition(neverHeld, cancelBy("creator", "2026-10-18T10:00:00Z"))).toEqual({ ok: false, reason: "closed_not_held" });
  });
});

describe("MP-FR-32 release", () => {
  const released = () => after(heldDeliverable(), cancelBy("brand"));
  const cancelAnswered = (outcome: "cancelled" | "already_ended" | "unknown" | "failed"): MoneyEvent => ({
    type: "hold_cancel_answered",
    outcome,
    at: at("2026-10-12T10:00:05Z"),
  });

  test.each(["cancelled", "already_ended"] as const)("PayPal answering %s confirms the release", (outcome) => {
    expect(transition(released(), cancelAnswered(outcome))).toMatchObject({
      ok: true,
      state: { stage: "released", release: { reason: "cancelled", confirmedAt: at("2026-10-12T10:00:05Z") } },
      effects: [],
    });
  });

  test("an unclear answer is followed up with PayPal", () => {
    const before = released();

    expect(transition(before, cancelAnswered("unknown"))).toEqual({
      ok: true,
      state: before,
      effects: [{ type: "check_hold_cancelled", reference: "AUTH-1" }],
    });
  });

  test("a release PayPal will not carry out is put in front of a person at Cleared", () => {
    expect(transition(released(), cancelAnswered("failed"))).toMatchObject({
      ok: true,
      effects: [{ type: "notify", to: "cleared", about: "release_failed" }],
    });
  });

  test("a confirmation that arrives twice changes nothing the second time", () => {
    const confirmed = after(released(), cancelAnswered("cancelled"));

    expect(transition(confirmed, cancelAnswered("cancelled"))).toEqual({ ok: true, state: confirmed, effects: [] });
  });

  test("it is refused for a deliverable that was never released", () => {
    expect(transition(heldDeliverable(), cancelAnswered("cancelled"))).toEqual({ ok: false, reason: "not_released" });
  });
});

describe("MP-FR-24 the first capture and the guarantee (revision 1.2)", () => {
  test("it re-confirms the hold first when the guarantee has ended", () => {
    // Held on the 10th and never renewed, so the guarantee ended on the 13th; the capture starts on the 17th.
    expect(transition(approvedToPay(), captureStarted())).toMatchObject({
      ok: true,
      effects: [{ type: "capture_hold", captureId: "cap_1", reference: "AUTH-1", renewFirst: true }],
    });
  });

  test("it does not re-confirm a hold that is still guaranteed", () => {
    // Renewed at 10:00:05 on the 15th, so guaranteed to the 18th.
    const approved = after(
      readyToPublish(),
      askGoAhead("2026-10-15T10:00:00Z"),
      { type: "hold_confirmed", confirmId: "conf_1", renewedReference: "AUTH-2", at: at("2026-10-15T10:00:05Z") },
      { type: "post_published", publishedAt: at("2026-10-16T09:00:00Z"), at: at("2026-10-16T09:05:00Z") },
      liveCheck("passed", "2026-10-16T09:10:00Z"),
    );

    expect(transition(approved, captureStarted("cap_1", "2026-10-16T09:10:01Z"))).toMatchObject({
      ok: true,
      effects: [{ type: "capture_hold", captureId: "cap_1", reference: "AUTH-2", renewFirst: false }],
    });
  });
});

describe("MP-FR-45 a payout PayPal will not send (revision 1.3)", () => {
  const refusedAt = (time: string, payoutId = "pay_1"): MoneyEvent => ({
    type: "payout_answered",
    payoutId,
    outcome: "refused",
    at: at(time),
  });
  const resendDue = (time: string, payoutId = "pay_1"): MoneyEvent => ({ type: "payout_resend_due", payoutId, at: at(time) });
  /** Captured, and PayPal refused to send the payout at 09:40:10 on 17 October. */
  const notSent = () => after(captured(), payoutStarted(), refusedAt("2026-10-17T09:40:10Z"));

  test("it stays captured, is tried again in 6 hours, and Cleared and the creator are told", () => {
    expect(transition(after(captured(), payoutStarted()), refusedAt("2026-10-17T09:40:10Z"))).toMatchObject({
      ok: true,
      state: { stage: "captured", payout: { id: "pay_1", status: "not_sent" } },
      effects: [
        { type: "schedule_job", job: "payout_resend", payoutId: "pay_1", at: at("2026-10-17T15:40:10Z") },
        { type: "notify", to: "cleared", about: "payout_not_sent" },
        { type: "notify", to: "creator", about: "payout_delayed" },
      ],
    });
  });

  test("the next try sends the same payout under the same id, so it can never be sent twice", () => {
    expect(transition(notSent(), resendDue("2026-10-17T15:40:10Z"))).toMatchObject({
      ok: true,
      state: { stage: "captured", payout: { id: "pay_1", status: "sending" } },
      effects: [{ type: "send_payout", payoutId: "pay_1", amountCents: 114_000 }],
    });
  });

  test("a second refusal schedules another try without telling anyone again", () => {
    const retrying = after(notSent(), resendDue("2026-10-17T15:40:10Z"));

    const result = transition(retrying, refusedAt("2026-10-17T15:40:20Z"));

    expect(result).toMatchObject({
      ok: true,
      state: { payout: { id: "pay_1", status: "not_sent" } },
      effects: [{ type: "schedule_job", job: "payout_resend", payoutId: "pay_1", at: at("2026-10-17T21:40:20Z") }],
    });
    expect(result).toMatchObject({ effects: expect.not.arrayContaining([expect.objectContaining({ type: "notify" })]) });
  });

  test("there is no end date: it is still tried long after day 28", () => {
    expect(transition(notSent(), resendDue("2026-12-01T00:00:00Z"))).toMatchObject({
      ok: true,
      effects: [{ type: "send_payout", payoutId: "pay_1" }],
    });
  });

  test("a retry that goes through is paid", () => {
    const retrying = after(notSent(), resendDue("2026-10-17T15:40:10Z"));

    expect(transition(retrying, payoutSucceeded("pay_1", "2026-10-17T15:45:00Z"))).toMatchObject({
      ok: true,
      state: { stage: "paid", payout: { id: "pay_1", status: "paid" } },
    });
  });

  test("the creator cannot ask for it to be sent again meanwhile (MP-FR-30)", () => {
    expect(
      transition(notSent(), { type: "payout_retry_requested", payoutId: "pay_2", at: at("2026-10-17T10:00:00Z") }),
    ).toEqual({ ok: false, reason: "payout_in_progress" });
  });

  test("the resend job does nothing unless that payout is waiting to be sent again", () => {
    const sending = after(captured(), payoutStarted());
    const waiting = notSent();

    expect(transition(sending, resendDue("2026-10-17T15:40:10Z"))).toEqual({ ok: true, state: sending, effects: [] });
    expect(transition(waiting, resendDue("2026-10-17T15:40:10Z", "pay_other"))).toEqual({
      ok: true,
      state: waiting,
      effects: [],
    });
  });

  test("a refusal about a payout PayPal already accepted changes nothing", () => {
    const unclaimed = after(captured(), payoutStarted(), payoutAnswered("unclaimed"));

    expect(transition(unclaimed, refusedAt("2026-10-17T09:50:00Z"))).toEqual({ ok: true, state: unclaimed, effects: [] });
  });
});
