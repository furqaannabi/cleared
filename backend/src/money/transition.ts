/**
 * The money path's transition rules (docs/specs/money-path-frd.md).
 *
 * Pure: no database, no PayPal, no clock. Given a deliverable's money state
 * and one event, it returns the next state and what to do next, or a refusal
 * with a reason. The money module's own calls, its jobs and PayPal's webhooks
 * all go through it (MP-FR-37).
 */

/** The terms a deliverable's money is created from. Amounts are whole cents (MP-BR-05). */
export interface MoneyTerms {
  amountCents: number;
  deadlineDays: number;
  creatorTimeZone: string;
}

/** One deliverable's money. */
export interface MoneyState extends MoneyTerms {
  /**
   * closed_not_held is final: the brand never held it within the time allowed (MP-FR-08).
   * released is final: the hold went back to the brand (MP-FR-32).
   * approved_not_paid is final: paying was approved, but the hold ended before it could be captured (MP-FR-23).
   * paid is final: the creator has the money and the deliverable is cleared (MP-FR-31).
   */
  stage: "not_held" | "held" | "captured" | "paid" | "closed_not_held" | "released" | "approved_not_paid";
  agreedAt: Date | null;
  attempt: HoldAttempt | null;
  hold: Hold | null;
  /** When the draft was cleared to publish. Decided outside this module (MP-FR-10). */
  draftClearedAt: Date | null;
  goAhead: GoAhead;
  /** When an approved post was published, as the live check reports it (MP-FR-16). */
  publishedAt: Date | null;
  /** The approval to pay, once there is one. No capture happens without it (MP-BR-04). */
  approval: Approval | null;
  /** Whose move it is after publishing, when the live check alone did not settle it. */
  waitingOn: WaitingOn | null;
  /** Why and when the hold was released. */
  release: Release | null;
  /** The latest try at capturing the hold. */
  capture: Capture | null;
  /** Cleared's fee and what the creator is paid, in cents. Fixed when the capture completes (MP-FR-27). */
  feeCents: number | null;
  payoutCents: number | null;
  /** The latest payout to the creator. There is never more than one in flight (MP-FR-30). */
  payout: Payout | null;
}

export interface Payout {
  id: string;
  /**
   * sending: PayPal has not reported a result. unclaimed: waiting for the creator to accept the money.
   * failed: finished without paying. cancelling: an unclaimed payout is being cancelled so `nextId` can be sent.
   */
  status: "sending" | "unclaimed" | "failed" | "cancelling" | "paid";
  /** How a failed payout ended. */
  why?: "failed" | "returned" | "blocked" | "denied";
  /** The payout to send once this one's cancellation is confirmed. */
  nextId?: string;
  /** PayPal's reference for a paid payout, and when it was paid. */
  reference?: string;
  at?: Date;
}

/** One try at capturing the hold. A new one is made only after PayPal clearly refused the last (MP-BR-06). */
export interface Capture {
  id: string;
  /** started: PayPal has not given a clear answer yet, so no other capture may begin (MP-FR-26). */
  status: "started" | "refused" | "completed";
  /** How many tries PayPal has refused so far (MP-FR-25). */
  refusals: number;
  /** PayPal's reference for the capture, and when it completed. */
  reference?: string;
  at?: Date;
}

/** Who or what approved paying for the live post (MP-FR-17 to MP-FR-21). */
export interface Approval {
  by: "live_check" | "brand_confirmed" | "brand_silence" | "cleared" | "brand_accepted";
  at: Date;
}

export type WaitingOn =
  /** The live check could not decide. The brand confirms or objects; silence pays (MP-FR-18). */
  | { for: "brand_to_confirm"; until: Date }
  /** The brand objected. A person at Cleared rules. The reason is untrusted text, never acted on (MP-BR-13). */
  | { for: "cleared_to_rule"; objection: string }
  /** The live check failed on something fixable. The creator fixes it and it is checked again (MP-FR-20). */
  | { for: "creator_to_fix"; until: Date }
  /** The live check failed on something that cannot be fixed. The brand may accept; silence does not pay (MP-FR-21). */
  | { for: "brand_to_accept"; until: Date };

export interface Release {
  reason: "deadline" | "hold_not_confirmed" | "day_28" | "cleared_ruled" | "fix_window_ended" | "not_accepted";
  at: Date;
}

/**
 * Where the creator stands on publishing (MP-FR-10 to MP-FR-15). A go-ahead is "running" only
 * between PayPal confirming the hold and the time it runs out.
 */
export type GoAhead =
  | { status: "none" }
  | { status: "confirming"; confirmId: string }
  | { status: "running"; until: Date }
  /** Too little of PayPal's guarantee is left, and it cannot be renewed before `until` (MP-FR-13). */
  | { status: "wait_until"; until: Date }
  /** PayPal could not confirm or renew the hold. The creator may ask again (MP-FR-14). */
  | { status: "not_confirmed" };

/** The deliverable's hold, with the three moments fixed when it was approved (MP-FR-04). */
export interface Hold {
  /** PayPal's reference for the hold. */
  reference: string;
  heldAt: Date;
  /** 23:59 in the creator's timezone, the agreed number of days after the hold. */
  deadlineAt: Date;
  /** When PayPal's guarantee of the held funds ends. */
  guaranteeEndsAt: Date;
  /** The last day anything about this hold may still be undecided (MP-FR-23). */
  day28At: Date;
}

/** One try at holding the deliverable's amount (MP-FR-01). */
export interface HoldAttempt {
  id: string;
  /** PayPal's order id, once PayPal has created the order. */
  orderId: string | null;
  /**
   * creating and awaiting_approval: nothing has been approved, so a new attempt may replace it.
   * authorizing, pending and unknown: PayPal has not given a final answer (MP-FR-06).
   * held, declined and closed: finished.
   */
  status: "creating" | "awaiting_approval" | "authorizing" | "pending" | "unknown" | "held" | "declined" | "closed";
  /** Why a declined attempt was declined: by PayPal, or because PayPal never answered (MP-FR-07). */
  declinedBecause?: "paypal_declined" | "timed_out";
}

export type MoneyEvent =
  | { type: "brand_agreed"; at: Date }
  | { type: "start_hold"; attemptId: string; at: Date }
  | { type: "order_created"; attemptId: string; orderId: string; at: Date }
  | { type: "hold_approved"; orderId: string; at: Date }
  | { type: "hold_closed"; orderId: string; at: Date }
  | { type: "attempt_stuck_due"; attemptId: string; at: Date }
  | { type: "never_held_due"; at: Date }
  | { type: "draft_cleared"; at: Date }
  | { type: "go_ahead_requested"; confirmId: string; at: Date }
  /** PayPal says the hold is in place. `renewedReference` is set when the hold had to be renewed. */
  | { type: "hold_confirmed"; confirmId: string; renewedReference?: string; at: Date }
  | { type: "hold_not_confirmed"; confirmId: string; at: Date }
  /** The go-ahead's end time has come. `publishedAt` is what the live check answered just before (MP-FR-15). */
  | { type: "go_ahead_ends_due"; publishedAt: Date | null; at: Date }
  | { type: "post_published"; publishedAt: Date; at: Date }
  /** The live check's result, decided by fixed code outside this module (MP-BR-01). */
  | { type: "live_check_result"; result: "passed" | "cannot_decide" | "failed_fixable" | "failed_not_fixable"; at: Date }
  | { type: "brand_confirmed"; at: Date }
  | { type: "brand_objected"; reason: string; at: Date }
  | { type: "brand_confirm_ends_due"; at: Date }
  | { type: "cleared_ruled"; decision: "pay" | "release"; at: Date }
  | { type: "fix_window_ends_due"; at: Date }
  | { type: "brand_accepted"; at: Date }
  | { type: "brand_accept_ends_due"; at: Date }
  /** The deadline has come. `publishedAt` is what the live check answered just before (MP-FR-22). */
  | { type: "deadline_due"; publishedAt: Date | null; at: Date }
  | { type: "day_28_due"; at: Date }
  | { type: "capture_started"; captureId: string; at: Date }
  /** `renewedReference` is set when the hold was renewed on the way to this answer (MP-FR-25). */
  | {
      type: "capture_answered";
      captureId: string;
      outcome: "completed";
      reference: string;
      renewedReference?: string;
      at: Date;
    }
  | { type: "capture_answered"; captureId: string; outcome: "refused"; renewedReference?: string; at: Date }
  | { type: "capture_answered"; captureId: string; outcome: "unknown"; renewedReference?: string; at: Date }
  | { type: "capture_retry_due"; captureId: string; at: Date }
  | { type: "payout_started"; payoutId: string; at: Date }
  | { type: "payout_answered"; payoutId: string; outcome: "succeeded"; reference: string; at: Date }
  | {
      type: "payout_answered";
      payoutId: string;
      outcome: "unclaimed" | "failed" | "returned" | "blocked" | "denied" | "unknown" | "cancelled";
      at: Date;
    }
  /** The creator asks for the payout to be sent again, after correcting their PayPal email (MP-FR-30). */
  | { type: "payout_retry_requested"; payoutId: string; at: Date }
  | { type: "authorize_answered"; attemptId: string; outcome: "held"; reference: string; at: Date }
  | { type: "authorize_answered"; attemptId: string; outcome: "declined" | "pending" | "unknown"; at: Date };

/** Something the money module must do after recording a transition. */
export type MoneyEffect =
  | { type: "create_order"; attemptId: string; amountCents: number }
  | { type: "authorize_order"; attemptId: string; orderId: string }
  | { type: "check_attempt"; attemptId: string }
  | { type: "cancel_attempt"; attemptId: string; orderId: string }
  | { type: "check_hold"; confirmId: string; reference: string }
  | { type: "renew_hold"; confirmId: string; reference: string }
  /** A notice recorded for one side. Showing or sending it is the job of the pages built later. */
  | { type: "notify"; to: "brand" | "creator" | "cleared"; about: Notice }
  /** Give the hold back to the brand. The call to PayPal is MP-FR-32. */
  | { type: "cancel_hold"; reference: string }
  /** An approval is on record: begin a capture attempt. */
  | { type: "start_capture" }
  /** Ask PayPal to capture the hold. Always the full amount held (MP-BR-03). */
  | { type: "capture_hold"; captureId: string; reference: string; amountCents: number; renewFirst: boolean }
  | { type: "check_capture"; captureId: string }
  /** The capture completed: begin a payout attempt. */
  | { type: "start_payout" }
  /** Pay the creator. The module reads their PayPal email at this moment; it is never part of the state. */
  | { type: "send_payout"; payoutId: string; amountCents: number }
  | { type: "check_payout"; payoutId: string }
  | { type: "cancel_payout"; payoutId: string }
  | { type: "schedule_job"; job: "attempt_stuck"; attemptId: string; at: Date }
  | {
      type: "schedule_job";
      job:
        | "never_held"
        | "deadline"
        | "day_28"
        | "go_ahead_ends"
        | "brand_confirm_ends"
        | "fix_window_ends"
        | "brand_accept_ends"
        | "capture_retry";
      at: Date;
    };

/** What a notice is about. Each becomes a message with a reason and a next step (MP-BR-15). */
export type Notice =
  | "hold_not_confirmed"
  | "confirm_live_post"
  | "brand_objected"
  | "fix_live_post"
  | "accept_failed_post"
  | "capture_failed"
  | "payment_failed"
  | "payout_unclaimed"
  | "payout_failed";

/** Why an event was refused. The routes built later turn each into its own message (MP-FR-02). */
export type Refusal =
  | "not_agreed"
  | "already_held"
  | "attempt_in_progress"
  | "closed_not_held"
  | "amount_below_minimum"
  | "amount_above_maximum"
  | "unknown_attempt"
  | "wrong_order"
  | "not_held"
  | "draft_not_cleared"
  | "deadline_passed"
  | "unknown_confirmation"
  | "not_published"
  | "nothing_to_confirm"
  | "nothing_to_rule_on"
  | "nothing_to_accept"
  | "finished"
  | "not_approved"
  | "unknown_capture"
  | "capture_in_progress"
  | "not_captured"
  | "unknown_payout"
  | "payout_in_progress";

export type TransitionResult =
  | { ok: true; state: MoneyState; effects: MoneyEffect[] }
  | { ok: false; reason: Refusal };

/** The numbers the spec leaves to configuration. */
export interface MoneySettings {
  /** The smallest and largest amount one hold can be, in cents (MP-FR-09). */
  minAmountCents: number;
  maxAmountCents: number;
  /** How long an approved attempt may go without a final answer from PayPal (MP-FR-07). */
  stuckAttemptHours: number;
  /** How long after the brand agrees a deliverable may go without a hold (MP-FR-08). */
  neverHeldDays: number;
  /** How long a go-ahead lasts at most, and how long before the guarantee ends it must stop (MP-FR-13). */
  goAheadHours: number;
  guaranteeMarginHours: number;
  /** How long the brand has to answer about a live post (MP-FR-18, MP-FR-21). */
  brandWindowHours: number;
  /** The least time a creator gets to fix a failed live post, when the deadline is nearer (MP-FR-20). */
  fixWindowHours: number;
  /** Cleared's fee, in hundredths of a percent: 500 is 5% (MP-FR-27). */
  feeBasisPoints: number;
  /** How long after a refused capture the next try is made (MP-FR-25). */
  captureRetryHours: number;
}

/** The values in the signed spec. */
export const defaultSettings: MoneySettings = {
  minAmountCents: 2_000,
  maxAmountCents: 1_000_000,
  stuckAttemptHours: 24,
  neverHeldDays: 7,
  goAheadHours: 48,
  guaranteeMarginHours: 24,
  brandWindowHours: 48,
  fixWindowHours: 24,
  feeBasisPoints: 500,
  captureRetryHours: 6,
};

/** A deliverable's money before the brand has agreed anything. */
export function newMoney(terms: MoneyTerms): MoneyState {
  return {
    ...terms,
    stage: "not_held",
    agreedAt: null,
    attempt: null,
    hold: null,
    draftClearedAt: null,
    goAhead: { status: "none" },
    publishedAt: null,
    approval: null,
    waitingOn: null,
    release: null,
    capture: null,
    feeCents: null,
    payoutCents: null,
    payout: null,
  };
}

const refuse = (reason: Refusal): TransitionResult => ({ ok: false, reason });

/** An event that arrives again, or too late to matter, is accepted and changes nothing. */
const unchanged = (state: MoneyState): TransitionResult => ({ ok: true, state, effects: [] });

/** True while PayPal has been asked to authorize the attempt and has not given a final answer. */
const awaitingPayPal = (attempt: HoldAttempt) =>
  attempt.status === "authorizing" || attempt.status === "pending" || attempt.status === "unknown";

const hoursAfter = (from: Date, hours: number) => new Date(from.getTime() + hours * 3_600_000);

const daysAfter = (from: Date, days: number) => hoursAfter(from, days * 24);

const earliest = (...moments: Date[]) => new Date(Math.min(...moments.map((moment) => moment.getTime())));

const latest = (...moments: Date[]) => new Date(Math.max(...moments.map((moment) => moment.getTime())));

/**
 * The last moment a go-ahead may cover under the current guarantee (MP-FR-13). Normally that is the margin
 * before the guarantee ends. A deadline that falls inside the guarantee has no margin: the funds are
 * guaranteed past it, and waiting for a renewal would leave the creator no time to publish.
 */
const guaranteeCovers = (hold: Hold, settings: MoneySettings) =>
  hold.deadlineAt < hold.guaranteeEndsAt
    ? hold.deadlineAt
    : hoursAfter(hold.guaranteeEndsAt, -settings.guaranteeMarginHours);

/** True when too little of the guarantee is left for a go-ahead and PayPal cannot renew it yet. */
const mustWaitForRenewal = (hold: Hold, now: Date, settings: MoneySettings) =>
  hold.deadlineAt >= hold.guaranteeEndsAt && now >= guaranteeCovers(hold, settings);

/** Puts the approval to pay on record and starts the capture. */
const approve = (state: MoneyState, by: Approval["by"], at: Date): TransitionResult => ({
  ok: true,
  state: { ...state, approval: { by, at }, waitingOn: null },
  effects: [{ type: "start_capture" }],
});

/**
 * Gives the hold back to the brand. A deliverable that was approved to pay ends as approved, not paid,
 * so its pages can say the post was accepted and why no money arrived (MP-FR-23).
 */
function release(state: MoneyState, reason: Release["reason"], at: Date): TransitionResult {
  if (!state.hold) return refuse("not_held");
  return {
    ok: true,
    state: {
      ...state,
      stage: state.approval ? "approved_not_paid" : "released",
      waitingOn: null,
      release: { reason, at },
    },
    effects: [{ type: "cancel_hold", reference: state.hold.reference }],
  };
}

/** Asks PayPal to capture the hold in full, re-confirming it first when asked to (MP-FR-25). */
const captureHold = (state: MoneyState, hold: Hold, captureId: string, renewFirst: boolean): MoneyEffect => ({
  type: "capture_hold",
  captureId,
  reference: hold.reference,
  amountCents: state.amountCents,
  renewFirst,
});

/** The events that ask for something, as opposed to jobs falling due and PayPal's answers. */
const REQUESTS: ReadonlySet<MoneyEvent["type"]> = new Set([
  "brand_agreed",
  "start_hold",
  "hold_approved",
  "hold_closed",
  "draft_cleared",
  "go_ahead_requested",
  "post_published",
  "live_check_result",
  "brand_confirmed",
  "brand_objected",
  "cleared_ruled",
  "brand_accepted",
  "payout_retry_requested",
]);

/** Sends a new payout for what the creator is owed. */
function sendPayout(state: MoneyState, payoutId: string): TransitionResult {
  if (state.stage !== "captured" || state.payoutCents === null) return refuse("not_captured");
  return {
    ok: true,
    state: { ...state, payout: { id: payoutId, status: "sending" } },
    effects: [{ type: "send_payout", payoutId, amountCents: state.payoutCents }],
  };
}

/** Tells the creator to come back when PayPal can renew the hold. */
const waitForRenewal = (state: MoneyState, hold: Hold): TransitionResult => ({
  ok: true,
  state: { ...state, goAhead: { status: "wait_until", until: hold.guaranteeEndsAt } },
  effects: [],
});

/** PayPal guarantees held funds for 3 days and ends a hold after 29; day 28 leaves one day's margin. */
const GUARANTEE_DAYS = 3;
const LAST_DAY = 28;

/**
 * 23:59 in the creator's timezone, `days` calendar days after the day `from` falls on there
 * (docs/decisions/2026-10-06-deadline-shared-date-with-local-time.md).
 */
function deadlineAfter(from: Date, days: number, timeZone: string): Date {
  const start = wallClock(from, timeZone);
  // The wall-clock time we want, written as if it were UTC. Date.UTC rolls the day over month ends.
  const wanted = Date.UTC(start.year, start.month - 1, start.day + days, 23, 59);
  // Correct by the zone's offset at that moment; the second pass settles a clock change in between.
  let moment = wanted;
  for (let pass = 0; pass < 2; pass++) {
    const shown = wallClock(new Date(moment), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    moment += wanted - shownAsUtc;
  }
  return new Date(moment);
}

/** What a clock on the wall reads in `timeZone` at `moment`. */
function wallClock(moment: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(moment);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

/** Applies one event to a deliverable's money. */
export function transition(
  state: MoneyState,
  event: MoneyEvent,
  settings: MoneySettings = defaultSettings,
): TransitionResult {
  // Nothing changes a deliverable's money once it is paid, released or ended unpaid (MP-BR-08).
  if (state.stage === "released" || state.stage === "approved_not_paid" || state.stage === "paid") {
    return REQUESTS.has(event.type) ? refuse("finished") : unchanged(state);
  }
  switch (event.type) {
    case "brand_agreed":
      return {
        ok: true,
        state: { ...state, agreedAt: event.at },
        effects: [{ type: "schedule_job", job: "never_held", at: daysAfter(event.at, settings.neverHeldDays) }],
      };
    case "never_held_due":
      if (state.stage !== "not_held") return unchanged(state);
      // An approved attempt may still come back held. It settles within MP-FR-07's limit, so the job tries again.
      if (state.attempt && awaitingPayPal(state.attempt)) return refuse("attempt_in_progress");
      return { ok: true, state: { ...state, stage: "closed_not_held" }, effects: [] };
    case "start_hold":
      if (state.stage === "closed_not_held") return refuse("closed_not_held");
      if (state.stage === "held") return refuse("already_held");
      if (!state.agreedAt) return refuse("not_agreed");
      if (state.attempt && awaitingPayPal(state.attempt)) return refuse("attempt_in_progress");
      if (state.amountCents < settings.minAmountCents) return refuse("amount_below_minimum");
      if (state.amountCents > settings.maxAmountCents) return refuse("amount_above_maximum");
      return {
        ok: true,
        state: { ...state, attempt: { id: event.attemptId, orderId: null, status: "creating" } },
        effects: [{ type: "create_order", attemptId: event.attemptId, amountCents: state.amountCents }],
      };
    case "order_created": {
      const attempt = state.attempt;
      if (!attempt || attempt.id !== event.attemptId) return refuse("unknown_attempt");
      if (attempt.status !== "creating") return unchanged(state);
      return {
        ok: true,
        state: { ...state, attempt: { ...attempt, orderId: event.orderId, status: "awaiting_approval" } },
        effects: [],
      };
    }
    case "hold_approved": {
      if (state.stage === "closed_not_held") return refuse("closed_not_held");
      const attempt = state.attempt;
      if (!attempt || attempt.orderId !== event.orderId) return refuse("wrong_order");
      if (attempt.status !== "awaiting_approval") return unchanged(state);
      return {
        ok: true,
        state: { ...state, attempt: { ...attempt, status: "authorizing" } },
        effects: [
          { type: "authorize_order", attemptId: attempt.id, orderId: event.orderId },
          {
            type: "schedule_job",
            job: "attempt_stuck",
            attemptId: attempt.id,
            at: hoursAfter(event.at, settings.stuckAttemptHours),
          },
        ],
      };
    }
    case "hold_closed": {
      const attempt = state.attempt;
      if (!attempt || attempt.orderId !== event.orderId) return refuse("wrong_order");
      if (attempt.status !== "awaiting_approval") return unchanged(state);
      return { ok: true, state: { ...state, attempt: { ...attempt, status: "closed" } }, effects: [] };
    }
    case "attempt_stuck_due": {
      const attempt = state.attempt;
      if (!attempt || attempt.id !== event.attemptId || !awaitingPayPal(attempt) || !attempt.orderId) {
        return unchanged(state);
      }
      return {
        ok: true,
        state: { ...state, attempt: { ...attempt, status: "declined", declinedBecause: "timed_out" } },
        effects: [{ type: "cancel_attempt", attemptId: attempt.id, orderId: attempt.orderId }],
      };
    }
    case "draft_cleared":
      return { ok: true, state: { ...state, draftClearedAt: event.at }, effects: [] };
    case "go_ahead_requested": {
      if (state.stage !== "held" || !state.hold) return refuse("not_held");
      if (!state.draftClearedAt) return refuse("draft_not_cleared");
      if (event.at >= state.hold.deadlineAt) return refuse("deadline_passed");
      if (state.goAhead.status === "confirming" || state.goAhead.status === "running") return unchanged(state);
      // PayPal can only renew a hold once its guarantee has ended; until then we ask whether it still stands.
      const insideGuarantee = event.at < state.hold.guaranteeEndsAt;
      if (insideGuarantee && mustWaitForRenewal(state.hold, event.at, settings)) {
        return waitForRenewal(state, state.hold);
      }
      const ask = insideGuarantee ? "check_hold" : "renew_hold";
      return {
        ok: true,
        state: { ...state, goAhead: { status: "confirming", confirmId: event.confirmId } },
        effects: [{ type: ask, confirmId: event.confirmId, reference: state.hold.reference }],
      };
    }
    case "hold_confirmed": {
      if (!state.hold) return refuse("not_held");
      if (state.goAhead.status !== "confirming") return unchanged(state);
      if (state.goAhead.confirmId !== event.confirmId) return refuse("unknown_confirmation");
      const hold: Hold = event.renewedReference
        ? { ...state.hold, reference: event.renewedReference, guaranteeEndsAt: daysAfter(event.at, GUARANTEE_DAYS) }
        : state.hold;
      if (mustWaitForRenewal(hold, event.at, settings)) return waitForRenewal(state, hold);
      const until = earliest(
        hoursAfter(event.at, settings.goAheadHours),
        guaranteeCovers(hold, settings),
        hold.deadlineAt,
      );
      return {
        ok: true,
        state: { ...state, hold, goAhead: { status: "running", until } },
        effects: [{ type: "schedule_job", job: "go_ahead_ends", at: until }],
      };
    }
    case "hold_not_confirmed": {
      if (state.goAhead.status !== "confirming") return unchanged(state);
      if (state.goAhead.confirmId !== event.confirmId) return refuse("unknown_confirmation");
      return {
        ok: true,
        state: { ...state, goAhead: { status: "not_confirmed" } },
        effects: [{ type: "notify", to: "brand", about: "hold_not_confirmed" }],
      };
    }
    case "go_ahead_ends_due": {
      if (state.goAhead.status !== "running" || event.at < state.goAhead.until) return unchanged(state);
      // A published post keeps its go-ahead, so nobody can cancel while the live check runs (MP-FR-33).
      if (event.publishedAt) return { ok: true, state: { ...state, publishedAt: event.publishedAt }, effects: [] };
      return { ok: true, state: { ...state, goAhead: { status: "none" } }, effects: [] };
    }
    case "post_published":
      if (state.stage !== "held") return refuse("not_held");
      if (state.publishedAt) return unchanged(state);
      return { ok: true, state: { ...state, publishedAt: event.publishedAt }, effects: [] };
    case "live_check_result": {
      if (state.stage !== "held" || !state.hold) return refuse("not_held");
      if (!state.publishedAt) return refuse("not_published");
      // Once paying is approved, or a person at Cleared is ruling, a new result changes nothing.
      if (state.approval || state.waitingOn?.for === "cleared_to_rule") return unchanged(state);
      const brandWindowEnds = hoursAfter(event.at, settings.brandWindowHours);
      switch (event.result) {
        case "passed":
          return approve(state, "live_check", event.at);
        case "cannot_decide":
          if (state.waitingOn?.for === "brand_to_confirm") return unchanged(state);
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "brand_to_confirm", until: brandWindowEnds } },
            effects: [
              { type: "schedule_job", job: "brand_confirm_ends", at: brandWindowEnds },
              { type: "notify", to: "brand", about: "confirm_live_post" },
            ],
          };
        case "failed_fixable": {
          // The window is set by the first failure. Failing again inside it does not extend it.
          if (state.waitingOn?.for === "creator_to_fix") return unchanged(state);
          const until = latest(state.hold.deadlineAt, hoursAfter(event.at, settings.fixWindowHours));
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "creator_to_fix", until } },
            effects: [
              { type: "schedule_job", job: "fix_window_ends", at: until },
              { type: "notify", to: "creator", about: "fix_live_post" },
            ],
          };
        }
        case "failed_not_fixable":
          if (state.waitingOn?.for === "brand_to_accept") return unchanged(state);
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "brand_to_accept", until: brandWindowEnds } },
            effects: [
              { type: "schedule_job", job: "brand_accept_ends", at: brandWindowEnds },
              { type: "notify", to: "brand", about: "accept_failed_post" },
            ],
          };
      }
    }
    case "deadline_due": {
      if (state.stage !== "held" || !state.hold || event.at < state.hold.deadlineAt) return unchanged(state);
      const publishedAt = state.publishedAt ?? event.publishedAt;
      if (publishedAt && publishedAt <= state.hold.deadlineAt) {
        return { ok: true, state: { ...state, publishedAt }, effects: [] };
      }
      // A creator who was told not to publish did not miss the deadline by choice; the reason says so.
      return release(state, state.goAhead.status === "not_confirmed" ? "hold_not_confirmed" : "deadline", event.at);
    }
    case "day_28_due":
      if (state.stage !== "held" || !state.hold || event.at < state.hold.day28At) return unchanged(state);
      // PayPal may already have captured. Releasing now could leave money taken on a deliverable shown as unpaid.
      if (state.capture?.status === "started") return refuse("capture_in_progress");
      return release(state, "day_28", event.at);
    case "capture_started":
      if (state.stage !== "held" || !state.hold) return refuse("not_held");
      if (!state.approval) return refuse("not_approved");
      // The first try only. Later tries are made by the retry job, after a clear refusal.
      if (state.capture) return unchanged(state);
      return {
        ok: true,
        state: { ...state, capture: { id: event.captureId, status: "started", refusals: 0 } },
        effects: [captureHold(state, state.hold, event.captureId, false)],
      };
    case "capture_retry_due": {
      if (state.stage !== "held" || !state.hold || state.capture?.status !== "refused") return unchanged(state);
      // From day 28 the day 28 job ends the deliverable; no further try is made.
      if (event.at >= state.hold.day28At) return unchanged(state);
      return {
        ok: true,
        state: { ...state, capture: { ...state.capture, id: event.captureId, status: "started" } },
        effects: [captureHold(state, state.hold, event.captureId, event.at >= state.hold.guaranteeEndsAt)],
      };
    }
    case "capture_answered": {
      if (!state.capture || state.capture.id !== event.captureId) return refuse("unknown_capture");
      if (state.capture.status !== "started") return unchanged(state);
      if (event.outcome === "unknown") {
        return { ok: true, state, effects: [{ type: "check_capture", captureId: event.captureId }] };
      }
      const hold =
        state.hold && event.renewedReference
          ? { ...state.hold, reference: event.renewedReference, guaranteeEndsAt: daysAfter(event.at, GUARANTEE_DAYS) }
          : state.hold;
      if (event.outcome === "refused") {
        const firstRefusal = state.capture.refusals === 0;
        return {
          ok: true,
          state: { ...state, hold, capture: { ...state.capture, status: "refused", refusals: state.capture.refusals + 1 } },
          effects: [
            { type: "schedule_job", job: "capture_retry", at: hoursAfter(event.at, settings.captureRetryHours) },
            // Both sides are told once, when the trouble starts, not on every try.
            ...(firstRefusal
              ? ([
                  { type: "notify", to: "creator", about: "capture_failed" },
                  { type: "notify", to: "brand", about: "payment_failed" },
                ] as const)
              : []),
          ],
        };
      }
      // Whole cents, rounded down: any fraction of a cent goes to the creator.
      const feeCents = Math.floor((state.amountCents * settings.feeBasisPoints) / 10_000);
      return {
        ok: true,
        state: {
          ...state,
          hold,
          stage: "captured",
          capture: { ...state.capture, status: "completed", reference: event.reference, at: event.at },
          feeCents,
          payoutCents: state.amountCents - feeCents,
        },
        effects: [{ type: "start_payout" }],
      };
    }
    case "payout_started":
      if (state.stage !== "captured") return refuse("not_captured");
      // The first payout only. Another is sent only when the creator asks, after this one ends unpaid.
      if (state.payout) return unchanged(state);
      return sendPayout(state, event.payoutId);
    case "payout_retry_requested": {
      if (state.stage !== "captured") return refuse("not_captured");
      const payout = state.payout;
      if (payout?.status === "failed") return sendPayout(state, event.payoutId);
      if (payout?.status === "unclaimed") {
        // The money is still on offer at the old email. It must be withdrawn before any is sent elsewhere.
        return {
          ok: true,
          state: { ...state, payout: { ...payout, status: "cancelling", nextId: event.payoutId } },
          effects: [{ type: "cancel_payout", payoutId: payout.id }],
        };
      }
      return refuse("payout_in_progress");
    }
    case "payout_answered": {
      const payout = state.payout;
      if (!payout || payout.id !== event.payoutId) return refuse("unknown_payout");
      if (payout.status === "failed") return unchanged(state);
      switch (event.outcome) {
        case "succeeded":
          return {
            ok: true,
            state: {
              ...state,
              stage: "paid",
              payout: { id: payout.id, status: "paid", reference: event.reference, at: event.at },
            },
            effects: [],
          };
        case "unknown":
          return { ok: true, state, effects: [{ type: "check_payout", payoutId: payout.id }] };
        case "unclaimed":
          if (payout.status !== "sending") return unchanged(state);
          return {
            ok: true,
            state: { ...state, payout: { ...payout, status: "unclaimed" } },
            effects: [{ type: "notify", to: "creator", about: "payout_unclaimed" }],
          };
        case "cancelled":
          if (payout.status !== "cancelling" || !payout.nextId) return unchanged(state);
          return sendPayout(state, payout.nextId);
        default:
          return {
            ok: true,
            state: { ...state, payout: { id: payout.id, status: "failed", why: event.outcome } },
            effects: [{ type: "notify", to: "creator", about: "payout_failed" }],
          };
      }
    }
    case "fix_window_ends_due":
      if (state.waitingOn?.for !== "creator_to_fix" || event.at < state.waitingOn.until) return unchanged(state);
      return release(state, "fix_window_ended", event.at);
    case "brand_accepted":
      if (state.waitingOn?.for !== "brand_to_accept") return refuse("nothing_to_accept");
      return approve(state, "brand_accepted", event.at);
    case "brand_accept_ends_due":
      if (state.waitingOn?.for !== "brand_to_accept" || event.at < state.waitingOn.until) return unchanged(state);
      return release(state, "not_accepted", event.at);
    case "brand_confirmed":
      if (state.waitingOn?.for !== "brand_to_confirm") return refuse("nothing_to_confirm");
      return approve(state, "brand_confirmed", event.at);
    case "brand_objected":
      if (state.waitingOn?.for !== "brand_to_confirm") return refuse("nothing_to_confirm");
      return {
        ok: true,
        state: { ...state, waitingOn: { for: "cleared_to_rule", objection: event.reason } },
        effects: [{ type: "notify", to: "cleared", about: "brand_objected" }],
      };
    case "brand_confirm_ends_due":
      if (state.waitingOn?.for !== "brand_to_confirm" || event.at < state.waitingOn.until) return unchanged(state);
      return approve(state, "brand_silence", event.at);
    case "cleared_ruled":
      if (state.waitingOn?.for !== "cleared_to_rule") return refuse("nothing_to_rule_on");
      return event.decision === "pay" ? approve(state, "cleared", event.at) : release(state, "cleared_ruled", event.at);
    case "authorize_answered": {
      const attempt = state.attempt;
      if (!attempt || attempt.id !== event.attemptId) return refuse("unknown_attempt");
      if (!awaitingPayPal(attempt)) return unchanged(state);
      if (event.outcome === "declined") {
        return {
          ok: true,
          state: { ...state, attempt: { ...attempt, status: "declined", declinedBecause: "paypal_declined" } },
          effects: [],
        };
      }
      if (event.outcome !== "held") {
        return {
          ok: true,
          state: { ...state, attempt: { ...attempt, status: event.outcome } },
          effects: [{ type: "check_attempt", attemptId: attempt.id }],
        };
      }
      const hold: Hold = {
        reference: event.reference,
        heldAt: event.at,
        deadlineAt: deadlineAfter(event.at, state.deadlineDays, state.creatorTimeZone),
        guaranteeEndsAt: daysAfter(event.at, GUARANTEE_DAYS),
        day28At: daysAfter(event.at, LAST_DAY),
      };
      return {
        ok: true,
        state: { ...state, stage: "held", attempt: { ...attempt, status: "held" }, hold },
        effects: [
          { type: "schedule_job", job: "deadline", at: hold.deadlineAt },
          { type: "schedule_job", job: "day_28", at: hold.day28At },
        ],
      };
    }
  }
}
