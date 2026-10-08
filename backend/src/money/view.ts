/** What the pages are shown of a deliverable's money (MP-FR-40). Built so far: the hold and the go-ahead. */
import type { MoneyState } from "./types";

/**
 * One post's hold, in the states the confirm and hold spec shows (CH-FR-18).
 * pending covers both PayPal reviewing the hold and PayPal not having answered yet.
 */
export type HoldView =
  | { state: "not_started" | "closed" | "declined" | "pending" | "unknown" }
  | { state: "held"; reference: string; heldAt: Date; deadlineAt: Date };

/**
 * Where the creator stands on publishing (MP-FR-10). confirming: PayPal has not answered yet, and is
 * being asked again. wait_until: too little of PayPal's guarantee is left, and the creator asks again then.
 */
export type GoAheadView =
  | { state: "none" | "confirming" | "not_confirmed" }
  | { state: "running" | "wait_until"; until: Date };

export interface MoneyView {
  stage: MoneyState["stage"];
  hold: HoldView;
  goAhead: GoAheadView;
  /** When the approved post was published, once the live check has reported it. */
  publishedAt: Date | null;
  /** Whose move it is after publishing, when the live check alone did not settle it. */
  waitingOn: MoneyState["waitingOn"];
  approval: MoneyState["approval"];
  capture: { status: "started" | "refused" | "completed"; reference?: string } | null;
  /** Cleared's fee and the creator's payout, in cents, once the hold is captured. */
  feeCents: number | null;
  payoutCents: number | null;
  payout: { status: NonNullable<MoneyState["payout"]>["status"]; why?: string; reference?: string } | null;
  release: MoneyState["release"];
}

export function goAheadView(state: MoneyState): GoAheadView {
  const goAhead = state.goAhead;
  return goAhead.status === "running" || goAhead.status === "wait_until"
    ? { state: goAhead.status, until: goAhead.until }
    : { state: goAhead.status };
}

export function holdView(state: MoneyState): HoldView {
  if (state.hold) {
    const { reference, heldAt, deadlineAt } = state.hold;
    return { state: "held", reference, heldAt, deadlineAt };
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

export function moneyView(state: MoneyState): MoneyView {
  const { capture, payout } = state;
  return {
    stage: state.stage,
    hold: holdView(state),
    goAhead: goAheadView(state),
    publishedAt: state.publishedAt,
    waitingOn: state.waitingOn,
    approval: state.approval,
    capture: capture && { status: capture.status, reference: capture.reference },
    feeCents: state.feeCents,
    payoutCents: state.payoutCents,
    payout: payout && { status: payout.status, why: payout.why, reference: payout.reference },
    release: state.release,
  };
}
