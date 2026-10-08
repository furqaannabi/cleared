/** Paying the creator (MP-FR-28 to MP-FR-31, MP-FR-45). */

import { refuse, unchanged } from "./outcomes";
import { hoursAfter } from "./time";
import type { EventOf, MoneySettings, MoneyState, TransitionResult } from "./types";

export type PayoutEvent = EventOf<
  "payout_started" | "payout_retry_requested" | "payout_answered" | "payout_resend_due"
>;

/** Sends a new payout for what the creator is owed. */
function sendPayout(state: MoneyState, payoutId: string): TransitionResult {
  if (state.stage !== "captured" || state.payoutCents === null) return refuse("not_captured");
  return {
    ok: true,
    state: { ...state, payout: { id: payoutId, status: "sending" } },
    effects: [{ type: "send_payout", payoutId, amountCents: state.payoutCents }],
  };
}

export function payoutTransition(state: MoneyState, event: PayoutEvent, settings: MoneySettings): TransitionResult {
  switch (event.type) {
    case "payout_resend_due": {
      const payout = state.payout;
      if (state.stage !== "captured" || state.payoutCents === null) return unchanged(state);
      if (payout?.status !== "not_sent" || payout.id !== event.payoutId) return unchanged(state);
      // The same payout id, so the same request id: if an earlier try did reach PayPal, it is not sent twice.
      return {
        ok: true,
        state: { ...state, payout: { ...payout, status: "sending" } },
        effects: [{ type: "send_payout", payoutId: payout.id, amountCents: state.payoutCents }],
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
        case "refused": {
          // Nothing was sent, and the reason is on Cleared's side, so the creator is not asked to fix anything.
          if (payout.status !== "sending") return unchanged(state);
          const refusals = (payout.refusals ?? 0) + 1;
          return {
            ok: true,
            state: { ...state, payout: { ...payout, status: "not_sent", refusals } },
            effects: [
              {
                type: "schedule_job",
                job: "payout_resend",
                payoutId: payout.id,
                at: hoursAfter(event.at, settings.payoutResendHours),
              },
              // Both are told once, when the trouble starts, not on every try.
              ...(refusals === 1
                ? ([
                    { type: "notify", to: "cleared", about: "payout_not_sent" },
                    { type: "notify", to: "creator", about: "payout_delayed" },
                  ] as const)
                : []),
            ],
          };
        }
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
