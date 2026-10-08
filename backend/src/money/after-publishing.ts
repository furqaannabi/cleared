/** After publishing: the live check's results, the brand's and Cleared's decisions, the deadline and day 28 (MP-FR-16 to MP-FR-23). */

import { approve, refuse, release, unchanged } from "./outcomes";
import { hoursAfter, latest } from "./time";
import type { EventOf, MoneySettings, MoneyState, TransitionResult } from "./types";

export type AfterPublishingEvent = EventOf<
  | "post_published"
  | "live_check_result"
  | "brand_confirmed"
  | "brand_objected"
  | "brand_confirm_ends_due"
  | "cleared_ruled"
  | "fix_window_ends_due"
  | "brand_accepted"
  | "brand_accept_ends_due"
  | "deadline_due"
  | "day_28_due"
>;

export function afterPublishingTransition(
  state: MoneyState,
  event: AfterPublishingEvent,
  settings: MoneySettings,
): TransitionResult {
  switch (event.type) {
    case "post_published":
      if (state.stage !== "held") return refuse("not_held");
      if (state.publishedAt) return unchanged(state);
      return { ok: true, state: { ...state, publishedAt: event.publishedAt }, effects: [] };
    case "live_check_result": {
      if (state.stage !== "held" || !state.hold) return refuse("not_held");
      if (!state.publishedAt) return refuse("not_published");
      // Once paying is approved, or a person at Cleared is ruling, a new result changes nothing.
      if (state.approval || state.waitingOn?.for === "cleared_to_rule") return unchanged(state);
      const brandWindowEnds = hoursAfter(event.at, settings.brandWindowHours);
      switch (event.result) {
        case "passed":
          return approve(state, "live_check", event.at);
        case "cannot_decide":
          if (state.waitingOn?.for === "brand_to_confirm") return unchanged(state);
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "brand_to_confirm", until: brandWindowEnds } },
            effects: [
              { type: "schedule_job", job: "brand_confirm_ends", at: brandWindowEnds },
              { type: "notify", to: "brand", about: "confirm_live_post" },
            ],
          };
        case "failed_fixable": {
          // The window is set by the first failure. Failing again inside it does not extend it.
          if (state.waitingOn?.for === "creator_to_fix") return unchanged(state);
          const until = latest(state.hold.deadlineAt, hoursAfter(event.at, settings.fixWindowHours));
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "creator_to_fix", until } },
            effects: [
              { type: "schedule_job", job: "fix_window_ends", at: until },
              { type: "notify", to: "creator", about: "fix_live_post" },
            ],
          };
        }
        case "failed_not_fixable":
          if (state.waitingOn?.for === "brand_to_accept") return unchanged(state);
          return {
            ok: true,
            state: { ...state, waitingOn: { for: "brand_to_accept", until: brandWindowEnds } },
            effects: [
              { type: "schedule_job", job: "brand_accept_ends", at: brandWindowEnds },
              { type: "notify", to: "brand", about: "accept_failed_post" },
            ],
          };
      }
    }
    case "brand_confirmed":
      if (state.waitingOn?.for !== "brand_to_confirm") return refuse("nothing_to_confirm");
      return approve(state, "brand_confirmed", event.at);
    case "brand_objected":
      if (state.waitingOn?.for !== "brand_to_confirm") return refuse("nothing_to_confirm");
      return {
        ok: true,
        state: { ...state, waitingOn: { for: "cleared_to_rule", objection: event.reason } },
        effects: [{ type: "notify", to: "cleared", about: "brand_objected" }],
      };
    case "brand_confirm_ends_due":
      if (state.waitingOn?.for !== "brand_to_confirm" || event.at < state.waitingOn.until) return unchanged(state);
      return approve(state, "brand_silence", event.at);
    case "cleared_ruled":
      if (state.waitingOn?.for !== "cleared_to_rule") return refuse("nothing_to_rule_on");
      return event.decision === "pay" ? approve(state, "cleared", event.at) : release(state, "cleared_ruled", event.at);
    case "fix_window_ends_due":
      if (state.waitingOn?.for !== "creator_to_fix" || event.at < state.waitingOn.until) return unchanged(state);
      return release(state, "fix_window_ended", event.at);
    case "brand_accepted":
      if (state.waitingOn?.for !== "brand_to_accept") return refuse("nothing_to_accept");
      return approve(state, "brand_accepted", event.at);
    case "brand_accept_ends_due":
      if (state.waitingOn?.for !== "brand_to_accept" || event.at < state.waitingOn.until) return unchanged(state);
      return release(state, "not_accepted", event.at);
    case "deadline_due": {
      if (state.stage !== "held" || !state.hold || event.at < state.hold.deadlineAt) return unchanged(state);
      const publishedAt = state.publishedAt ?? event.publishedAt;
      if (publishedAt && publishedAt <= state.hold.deadlineAt) {
        return { ok: true, state: { ...state, publishedAt }, effects: [] };
      }
      // A creator who was told not to publish did not miss the deadline by choice; the reason says so.
      return release(state, state.goAhead.status === "not_confirmed" ? "hold_not_confirmed" : "deadline", event.at);
    }
    case "day_28_due":
      if (state.stage !== "held" || !state.hold || event.at < state.hold.day28At) return unchanged(state);
      // PayPal may already have captured. Releasing now could leave money taken on a deliverable shown as unpaid.
      if (state.capture?.status === "started") return refuse("capture_in_progress");
      return release(state, "day_28", event.at);
  }
}
