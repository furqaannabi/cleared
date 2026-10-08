/** Starting and approving a hold (MP-FR-01 to MP-FR-09). */

import { awaitingPayPal, closedRefusal, refuse, unchanged } from "./outcomes";
import { GUARANTEE_DAYS, LAST_DAY, daysAfter, deadlineAfter, hoursAfter } from "./time";
import type { EventOf, Hold, MoneySettings, MoneyState, TransitionResult } from "./types";

export type HoldEvent = EventOf<
  | "brand_agreed"
  | "never_held_due"
  | "start_hold"
  | "order_created"
  | "hold_approved"
  | "hold_closed"
  | "attempt_stuck_due"
  | "authorize_answered"
>;

export function holdTransition(state: MoneyState, event: HoldEvent, settings: MoneySettings): TransitionResult {
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
      return {
        ok: true,
        state: { ...state, stage: "closed_not_held", closed: { because: "never_held", at: event.at } },
        effects: [],
      };
    case "start_hold":
      if (state.stage === "closed_not_held") return closedRefusal(state);
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
      if (state.stage === "closed_not_held") return closedRefusal(state);
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
