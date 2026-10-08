/** Capturing the hold, and Cleared's fee (MP-FR-24 to MP-FR-27). */

import { refuse, unchanged } from "./outcomes";
import { GUARANTEE_DAYS, daysAfter, hoursAfter } from "./time";
import type { EventOf, Hold, MoneyEffect, MoneySettings, MoneyState, TransitionResult } from "./types";

export type CaptureEvent = EventOf<"capture_started" | "capture_retry_due" | "capture_answered">;

/**
 * Asks PayPal to capture the hold in full. The hold is re-confirmed first when its guarantee has ended,
 * on the first try and on every retry (MP-FR-24, MP-FR-25).
 */
const captureHold = (state: MoneyState, hold: Hold, captureId: string, now: Date): MoneyEffect => ({
  type: "capture_hold",
  captureId,
  reference: hold.reference,
  amountCents: state.amountCents,
  renewFirst: now >= hold.guaranteeEndsAt,
});

export function captureTransition(state: MoneyState, event: CaptureEvent, settings: MoneySettings): TransitionResult {
  switch (event.type) {
    case "capture_started":
      if (state.stage !== "held" || !state.hold) return refuse("not_held");
      if (!state.approval) return refuse("not_approved");
      // The first try only. Later tries are made by the retry job, after a clear refusal.
      if (state.capture) return unchanged(state);
      return {
        ok: true,
        state: { ...state, capture: { id: event.captureId, status: "started", refusals: 0 } },
        effects: [captureHold(state, state.hold, event.captureId, event.at)],
      };
    case "capture_retry_due": {
      if (state.stage !== "held" || !state.hold || state.capture?.status !== "refused") return unchanged(state);
      // From day 28 the day 28 job ends the deliverable; no further try is made.
      if (event.at >= state.hold.day28At) return unchanged(state);
      return {
        ok: true,
        state: { ...state, capture: { ...state.capture, id: event.captureId, status: "started" } },
        effects: [captureHold(state, state.hold, event.captureId, event.at)],
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
  }
}
