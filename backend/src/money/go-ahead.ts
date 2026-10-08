/** The go-ahead to publish (MP-FR-10 to MP-FR-15). */

import { refuse, unchanged } from "./outcomes";
import { GUARANTEE_DAYS, daysAfter, earliest, hoursAfter } from "./time";
import type { EventOf, Hold, MoneySettings, MoneyState, TransitionResult } from "./types";

export type GoAheadEvent = EventOf<
  "draft_cleared" | "go_ahead_requested" | "hold_confirmed" | "hold_not_confirmed" | "go_ahead_ends_due"
>;

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

export function goAheadTransition(state: MoneyState, event: GoAheadEvent, settings: MoneySettings): TransitionResult {
  switch (event.type) {
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
  }
}
