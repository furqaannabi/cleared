/** Cancelling a deliverable, and PayPal's confirmation that a released hold has ended (MP-FR-32 to MP-FR-34). */

import { awaitingPayPal, closedRefusal, refuse, release, unchanged } from "./outcomes";
import type { Closed, EventOf, MoneyState, TransitionResult } from "./types";

export function cancelTransition(state: MoneyState, event: EventOf<"cancel_requested">): TransitionResult {
  if (state.stage === "closed_not_held") return closedRefusal(state);
  if (state.publishedAt) return refuse("already_published");
  // A running go-ahead blocks cancelling until its end has been checked for a published post (MP-FR-15).
  if (state.goAhead.status === "running") return refuse("go_ahead_running");
  if (state.stage === "held") return release(state, "cancelled", event.at, event.by);
  const closed: Closed = { because: "cancelled", by: event.by, at: event.at };
  const attempt = state.attempt;
  if (attempt && awaitingPayPal(attempt) && attempt.orderId) {
    // PayPal may still authorize it, so it is cancelled there too (MP-FR-34).
    return {
      ok: true,
      state: {
        ...state,
        stage: "closed_not_held",
        closed,
        attempt: { ...attempt, status: "declined", declinedBecause: "cancelled" },
      },
      effects: [{ type: "cancel_attempt", attemptId: attempt.id, orderId: attempt.orderId }],
    };
  }
  return { ok: true, state: { ...state, stage: "closed_not_held", closed }, effects: [] };
}

/**
 * PayPal's answer about ending a hold arrives after the release is recorded. It confirms the release;
 * it changes no stage, so it is accepted even on a finished deliverable (MP-FR-32).
 */
export function releaseConfirmation(state: MoneyState, event: EventOf<"hold_cancel_answered">): TransitionResult {
  if (!state.release || !state.hold) return refuse("not_released");
  if (state.release.confirmedAt) return unchanged(state);
  switch (event.outcome) {
    case "cancelled":
    case "already_ended":
      return { ok: true, state: { ...state, release: { ...state.release, confirmedAt: event.at } }, effects: [] };
    case "unknown":
      return { ok: true, state, effects: [{ type: "check_hold_cancelled", reference: state.hold.reference }] };
    case "failed":
      // The brand's money may still be reserved. A person has to look.
      return { ok: true, state, effects: [{ type: "notify", to: "cleared", about: "release_failed" }] };
  }
}
