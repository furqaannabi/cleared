/** The results every section of the transition rules can produce. */

import type { Approval, HoldAttempt, MoneyState, Refusal, Release, TransitionResult } from "./types";

export const refuse = (reason: Refusal): TransitionResult => ({ ok: false, reason });

/** An event that arrives again, or too late to matter, is accepted and changes nothing. */
export const unchanged = (state: MoneyState): TransitionResult => ({ ok: true, state, effects: [] });

/** True while PayPal has been asked to authorize the attempt and has not given a final answer. */
export const awaitingPayPal = (attempt: HoldAttempt) =>
  attempt.status === "authorizing" || attempt.status === "pending" || attempt.status === "unknown";

/** The refusal for anything asked of a deliverable that was closed without a hold. */
export const closedRefusal = (state: MoneyState): TransitionResult =>
  refuse(state.closed?.because === "cancelled" ? "cancelled" : "closed_not_held");

/** Puts the approval to pay on record and starts the capture. */
export const approve = (state: MoneyState, by: Approval["by"], at: Date): TransitionResult => ({
  ok: true,
  state: { ...state, approval: { by, at }, waitingOn: null },
  effects: [{ type: "start_capture" }],
});

/**
 * Gives the hold back to the brand. A deliverable that was approved to pay ends as approved, not paid,
 * so its pages can say the post was accepted and why no money arrived (MP-FR-23).
 */
export function release(
  state: MoneyState,
  reason: Release["reason"],
  at: Date,
  by?: "creator" | "brand",
): TransitionResult {
  if (!state.hold) return refuse("not_held");
  return {
    ok: true,
    state: {
      ...state,
      stage: state.approval ? "approved_not_paid" : "released",
      waitingOn: null,
      release: by ? { reason, at, by } : { reason, at },
    },
    effects: [{ type: "cancel_hold", reference: state.hold.reference }],
  };
}
