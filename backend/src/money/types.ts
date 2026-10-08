/**
 * The money path's vocabulary (docs/specs/money-path-frd.md): a deliverable's money state, the events
 * that can happen to it, what the module must do next, and the numbers the spec leaves to configuration.
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
   * closed_not_held is final: it was never held in the time allowed, or was cancelled first (MP-FR-08, MP-FR-34).
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
  /** Why and when the deliverable was closed without a hold. */
  closed: Closed | null;
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
   * not_sent: PayPal will not send it, for a reason on Cleared's side; it is sent again on a timer (MP-FR-45).
   */
  status: "sending" | "not_sent" | "unclaimed" | "failed" | "cancelling" | "paid";
  /** How many times PayPal has refused to send it. It is sent again under the same id each time (MP-FR-45). */
  refusals?: number;
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
  reason:
    | "deadline"
    | "hold_not_confirmed"
    | "day_28"
    | "cleared_ruled"
    | "fix_window_ended"
    | "not_accepted"
    | "cancelled";
  at: Date;
  /** Who cancelled, when the reason is a cancellation. */
  by?: "creator" | "brand";
  /** When PayPal confirmed the hold had ended (MP-FR-32). */
  confirmedAt?: Date;
}

/** Why a deliverable was closed without ever being held. */
export interface Closed {
  because: "never_held" | "cancelled";
  by?: "creator" | "brand";
  at: Date;
}

/**
 * Where the creator stands on publishing (MP-FR-10 to MP-FR-15). A go-ahead is "running" only
 * between PayPal confirming the hold and the time it runs out.
 */
export type GoAhead =
  | { status: "none" }
  /** A go-ahead ran out with nothing published. The creator asks again (MP-FR-15). */
  | { status: "ended" }
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
  declinedBecause?: "paypal_declined" | "timed_out" | "cancelled";
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
      outcome: "unclaimed" | "failed" | "returned" | "blocked" | "denied" | "unknown" | "cancelled" | "refused";
      at: Date;
    }
  /** Time to send again a payout PayPal would not send (MP-FR-45). */
  | { type: "payout_resend_due"; payoutId: string; at: Date }
  | { type: "cancel_requested"; by: "creator" | "brand"; at: Date }
  /** PayPal's answer to ending a released hold (MP-FR-32). */
  | { type: "hold_cancel_answered"; outcome: "cancelled" | "already_ended" | "unknown" | "failed"; at: Date }
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
  | { type: "check_hold_cancelled"; reference: string }
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
  | { type: "schedule_job"; job: "payout_resend"; payoutId: string; at: Date }
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
  | "payout_failed"
  | "payout_not_sent"
  | "payout_delayed"
  | "release_failed";

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
  | "payout_in_progress"
  | "cancelled"
  | "go_ahead_running"
  | "already_published"
  | "not_released";

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
  /** How long after PayPal refuses to send a payout it is sent again (MP-FR-45). */
  payoutResendHours: number;
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
  payoutResendHours: 6,
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
    closed: null,
    capture: null,
    feeCents: null,
    payoutCents: null,
    payout: null,
  };
}

/** The event with the given type, for a section that handles only some events. */
export type EventOf<Type extends MoneyEvent["type"]> = Extract<MoneyEvent, { type: Type }>;
