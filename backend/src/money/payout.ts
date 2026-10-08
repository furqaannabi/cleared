/** Paying the creator (MP-FR-28 to MP-FR-31). */

import { refuse, unchanged } from "./outcomes";
import type { EventOf, MoneyState, TransitionResult } from "./types";

export type PayoutEvent = EventOf<"payout_started" | "payout_retry_requested" | "payout_answered">;

/** Sends a new payout for what the creator is owed. */
function sendPayout(state: MoneyState, payoutId: string): TransitionResult {
  if (state.stage !== "captured" || state.payoutCents === null) return refuse("not_captured");
  return {
    ok: true,
    state: { ...state, payout: { id: payoutId, status: "sending" } },
    effects: [{ type: "send_payout", payoutId, amountCents: state.payoutCents }],
  };
}

export function payoutTransition(state: MoneyState, event: PayoutEvent): TransitionResult {
  switch (event.type) {
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
  }
}
