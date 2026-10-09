/**
 * What the pages are shown of a deliverable's money (MP-FR-40). Pure: it reads a money state and decides
 * nothing. Amounts are decimal strings (MP-BR-05). It never holds the creator's PayPal email; the money
 * module adds that for the creator's own view only (MP-BR-14).
 */
import type { MoneyState } from "./types";

/**
 * One post's hold, in the states the confirm and hold spec shows (CH-FR-18).
 * pending covers both PayPal reviewing the hold and PayPal not having answered yet.
 */
export type HoldView =
  | { state: "not_started" | "closed" | "declined" | "pending" | "unknown" }
  | {
      state: "held";
      reference: string;
      heldAt: Date;
      /** The date the creator must post by. */
      deadlineAt: Date;
      /** When PayPal's guarantee of the held funds ends. */
      guaranteeEndsAt: Date;
      /** The last day anything about this hold may still be undecided. */
      day28At: Date;
    };

/**
 * Where the creator stands on publishing (MP-FR-10). confirming: PayPal has not answered yet, and is
 * being asked again. wait_until: too little of PayPal's guarantee is left, and the creator asks again then.
 * ended: a go-ahead ran out with nothing published (MP-FR-15).
 */
export type GoAheadView =
  | { state: "none" | "confirming" | "not_confirmed" | "ended" }
  | { state: "running" | "wait_until"; until: Date };

/** Whose move it is. cleared is Cleared itself: its checks, or a person there. */
type Who = "brand" | "creator" | "cleared" | "paypal" | "nobody";

/**
 * Why the creator is not paid yet, and what happens next (MP-BR-15). These are codes: the pages turn them
 * into words. `by` is the latest the step can happen; `from` is the earliest.
 */
export interface MoneyStatus {
  reason:
    | "waiting_for_agreement"
    | "waiting_for_hold"
    | "hold_closed"
    | "hold_declined"
    | "hold_with_paypal"
    | "waiting_for_cleared_draft"
    | "ready_to_publish"
    | "confirming_hold"
    | "go_ahead"
    | "go_ahead_ended"
    | "guarantee_running_out"
    | "hold_not_confirmed"
    | "waiting_for_live_check"
    | "live_check_undecided"
    | "brand_objected"
    | "live_check_failed"
    | "live_check_failed_for_good"
    | "capturing"
    | "capture_refused"
    | "payout_sending"
    | "payout_unclaimed"
    | "payout_failed"
    | "payout_being_cancelled"
    | "payout_delayed"
    | "released"
    | "approved_not_paid"
    | "never_held"
    | "cancelled";
  next: {
    who: Who;
    step:
      | "agree_terms"
      | "approve_hold"
      | "answer"
      | "get_draft_cleared"
      | "ask_for_go_ahead"
      | "publish"
      | "check_paypal_funding"
      | "check_live_post"
      | "confirm_or_object"
      | "rule"
      | "fix_post"
      | "accept_or_decline"
      | "accept_payout"
      | "correct_email_and_send_again"
      | "fix_payout_account"
      | "none";
    by?: Date;
    from?: Date;
  };
}

export interface MoneyView {
  stage: MoneyState["stage"];
  /** Null once the deliverable is paid. Every other stage says why it is not, and what happens next. */
  status: MoneyStatus | null;
  /** The fee and the payout are fixed when the hold is captured, and null before. */
  amounts: { amount: string; fee: string | null; payout: string | null; currency: "USD" };
  hold: HoldView;
  goAhead: GoAheadView;
  /** When the approved post was published, once the live check has reported it. */
  publishedAt: Date | null;
  /** Whose move it is after publishing, when the live check alone did not settle it. */
  waitingOn: MoneyState["waitingOn"];
  approval: MoneyState["approval"];
  capture: {
    status: "started" | "refused" | "completed";
    reference?: string;
    at?: Date;
    /** A refused capture is tried again until this moment (MP-FR-25). */
    retryUntil?: Date;
  } | null;
  payout: {
    status: NonNullable<MoneyState["payout"]>["status"];
    why?: string;
    reference?: string;
    at?: Date;
    /** Whether the creator may have it sent again now (MP-FR-30). */
    canSendAgain: boolean;
  } | null;
  release: MoneyState["release"];
  closed: MoneyState["closed"];
}

/** The creator's own view: the same, with the PayPal email their payout goes to. */
export type CreatorMoneyView = MoneyView & { payoutEmail: string };

/** Whole cents as a decimal string with two places: 120000 is "1200.00". */
export function decimal(amountCents: number): string {
  const text = String(amountCents).padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}

export function goAheadView(state: MoneyState): GoAheadView {
  const goAhead = state.goAhead;
  return goAhead.status === "running" || goAhead.status === "wait_until"
    ? { state: goAhead.status, until: goAhead.until }
    : { state: goAhead.status };
}

export function holdView(state: MoneyState): HoldView {
  if (state.hold) {
    const { reference, heldAt, deadlineAt, guaranteeEndsAt, day28At } = state.hold;
    return { state: "held", reference, heldAt, deadlineAt, guaranteeEndsAt, day28At };
  }
  switch (state.attempt?.status) {
    case "closed":
    case "declined":
    case "unknown":
      return { state: state.attempt.status };
    case "authorizing":
    case "pending":
      return { state: "pending" };
    default:
      // No attempt, or one the brand has not approved or closed yet.
      return { state: "not_started" };
  }
}

const DONE = { who: "nobody", step: "none" } as const;
const PAYPAL = { who: "paypal", step: "answer" } as const;

/** Why the deliverable is not paid, and whose move it is. Null only when it is paid. */
export function moneyStatus(state: MoneyState): MoneyStatus | null {
  switch (state.stage) {
    case "paid":
      return null;
    case "released":
      return { reason: "released", next: DONE };
    case "approved_not_paid":
      return { reason: "approved_not_paid", next: DONE };
    case "closed_not_held":
      return { reason: state.closed?.because === "cancelled" ? "cancelled" : "never_held", next: DONE };
    case "not_held":
      return beforeHold(state);
    case "held":
      return whileHeld(state);
    case "captured":
      return afterCapture(state);
  }
}

function beforeHold(state: MoneyState): MoneyStatus {
  const approve = { who: "brand", step: "approve_hold" } as const;
  if (!state.agreedAt) return { reason: "waiting_for_agreement", next: { who: "brand", step: "agree_terms" } };
  switch (state.attempt?.status) {
    case "closed":
      return { reason: "hold_closed", next: approve };
    case "declined":
      return { reason: "hold_declined", next: approve };
    case "authorizing":
    case "pending":
    case "unknown":
      return { reason: "hold_with_paypal", next: PAYPAL };
    default:
      return { reason: "waiting_for_hold", next: approve };
  }
}

function whileHeld(state: MoneyState): MoneyStatus {
  const hold = state.hold;
  const deadline = hold?.deadlineAt;
  const day28 = hold?.day28At;
  if (state.capture?.status === "refused") {
    return { reason: "capture_refused", next: { who: "brand", step: "check_paypal_funding", by: day28 } };
  }
  if (state.approval) return { reason: "capturing", next: PAYPAL };
  switch (state.waitingOn?.for) {
    case "brand_to_confirm":
      return { reason: "live_check_undecided", next: { who: "brand", step: "confirm_or_object", by: state.waitingOn.until } };
    case "cleared_to_rule":
      return { reason: "brand_objected", next: { who: "cleared", step: "rule", by: day28 } };
    case "creator_to_fix":
      return { reason: "live_check_failed", next: { who: "creator", step: "fix_post", by: state.waitingOn.until } };
    case "brand_to_accept":
      return { reason: "live_check_failed_for_good", next: { who: "brand", step: "accept_or_decline", by: state.waitingOn.until } };
  }
  if (state.publishedAt) return { reason: "waiting_for_live_check", next: { who: "cleared", step: "check_live_post" } };
  if (!state.draftClearedAt) {
    return { reason: "waiting_for_cleared_draft", next: { who: "creator", step: "get_draft_cleared", by: deadline } };
  }
  const ask = { who: "creator", step: "ask_for_go_ahead" } as const;
  switch (state.goAhead.status) {
    case "confirming":
      return { reason: "confirming_hold", next: PAYPAL };
    case "running":
      return { reason: "go_ahead", next: { who: "creator", step: "publish", by: state.goAhead.until } };
    case "wait_until":
      return { reason: "guarantee_running_out", next: { ...ask, from: state.goAhead.until } };
    case "not_confirmed":
      return { reason: "hold_not_confirmed", next: { who: "brand", step: "check_paypal_funding", by: deadline } };
    case "ended":
      return { reason: "go_ahead_ended", next: { ...ask, by: deadline } };
    case "none":
      return { reason: "ready_to_publish", next: { ...ask, by: deadline } };
  }
}

function afterCapture(state: MoneyState): MoneyStatus {
  switch (state.payout?.status) {
    case "unclaimed":
      return { reason: "payout_unclaimed", next: { who: "creator", step: "accept_payout" } };
    case "failed":
      return { reason: "payout_failed", next: { who: "creator", step: "correct_email_and_send_again" } };
    case "cancelling":
      return { reason: "payout_being_cancelled", next: PAYPAL };
    case "not_sent":
      return { reason: "payout_delayed", next: { who: "cleared", step: "fix_payout_account" } };
    default:
      return { reason: "payout_sending", next: PAYPAL };
  }
}

export function moneyView(state: MoneyState): MoneyView {
  const { capture, payout } = state;
  return {
    stage: state.stage,
    status: moneyStatus(state),
    amounts: {
      amount: decimal(state.amountCents),
      fee: state.feeCents === null ? null : decimal(state.feeCents),
      payout: state.payoutCents === null ? null : decimal(state.payoutCents),
      currency: "USD",
    },
    hold: holdView(state),
    goAhead: goAheadView(state),
    publishedAt: state.publishedAt,
    waitingOn: state.waitingOn,
    approval: state.approval,
    capture: capture && {
      status: capture.status,
      reference: capture.reference,
      at: capture.at,
      retryUntil: capture.status === "refused" ? state.hold?.day28At : undefined,
    },
    payout: payout && {
      status: payout.status,
      why: payout.why,
      reference: payout.reference,
      at: payout.at,
      canSendAgain: payout.status === "failed" || payout.status === "unclaimed",
    },
    release: state.release,
    closed: state.closed,
  };
}
