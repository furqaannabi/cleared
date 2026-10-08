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
  /** closed_not_held is final: the brand never held it within the time allowed (MP-FR-08). */
  stage: "not_held" | "held" | "closed_not_held";
  agreedAt: Date | null;
  attempt: HoldAttempt | null;
  hold: Hold | null;
  /** When the draft was cleared to publish. Decided outside this module (MP-FR-10). */
  draftClearedAt: Date | null;
  goAhead: GoAhead;
  /** When an approved post was published, as the live check reports it (MP-FR-16). */
  publishedAt: Date | null;
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
  | { type: "notify"; to: "brand" | "creator"; about: "hold_not_confirmed" }
  | { type: "schedule_job"; job: "attempt_stuck"; attemptId: string; at: Date }
  | { type: "schedule_job"; job: "never_held" | "deadline" | "day_28" | "go_ahead_ends"; at: Date };

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
  | "unknown_confirmation";

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
}

/** The values in the signed spec. */
export const defaultSettings: MoneySettings = {
  minAmountCents: 2_000,
  maxAmountCents: 1_000_000,
  stuckAttemptHours: 24,
  neverHeldDays: 7,
  goAheadHours: 48,
  guaranteeMarginHours: 24,
};

/** A deliverable's money before the brand has agreed anything. */
export function newMoney(terms: MoneyTerms): MoneyState {
  return { ...terms, stage: "not_held", agreedAt: null, attempt: null, hold: null, draftClearedAt: null, goAhead: { status: "none" }, publishedAt: null };
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
