/**
 * The money path's transition rules (docs/specs/money-path-frd.md).
 *
 * Pure: no database, no PayPal, no clock. Given a deliverable's money state
 * and one event, it returns the next state and what to do next, or a refusal
 * with a reason. The money module's own calls, its jobs and PayPal's webhooks
 * all go through it (MP-FR-37).
 *
 * Each section of the spec has its own file; this one decides which applies.
 */

import { afterPublishingTransition } from "./after-publishing";
import { captureTransition } from "./capture";
import { goAheadTransition } from "./go-ahead";
import { holdTransition } from "./hold";
import { refuse, unchanged } from "./outcomes";
import { payoutTransition } from "./payout";
import { cancelTransition, releaseConfirmation } from "./release";
import { defaultSettings, type MoneyEvent, type MoneySettings, type MoneyState, type TransitionResult } from "./types";

export * from "./types";

/** The events that ask for something, as opposed to jobs falling due and PayPal's answers. */
const REQUESTS: ReadonlySet<MoneyEvent["type"]> = new Set([
  "brand_agreed",
  "start_hold",
  "hold_approved",
  "hold_closed",
  "draft_cleared",
  "go_ahead_requested",
  "post_published",
  "live_check_result",
  "brand_confirmed",
  "brand_objected",
  "cleared_ruled",
  "brand_accepted",
  "payout_retry_requested",
  "cancel_requested",
]);

/** Applies one event to a deliverable's money. */
export function transition(
  state: MoneyState,
  event: MoneyEvent,
  settings: MoneySettings = defaultSettings,
): TransitionResult {
  if (event.type === "hold_cancel_answered") return releaseConfirmation(state, event);
  // Nothing changes a deliverable's money once it is paid, released or ended unpaid (MP-BR-08).
  if (state.stage === "released" || state.stage === "approved_not_paid" || state.stage === "paid") {
    return REQUESTS.has(event.type) ? refuse("finished") : unchanged(state);
  }
  switch (event.type) {
    case "brand_agreed":
    case "never_held_due":
    case "start_hold":
    case "order_created":
    case "hold_approved":
    case "hold_closed":
    case "attempt_stuck_due":
    case "authorize_answered":
      return holdTransition(state, event, settings);
    case "draft_cleared":
    case "go_ahead_requested":
    case "hold_confirmed":
    case "hold_not_confirmed":
    case "go_ahead_ends_due":
      return goAheadTransition(state, event, settings);
    case "post_published":
    case "live_check_result":
    case "brand_confirmed":
    case "brand_objected":
    case "brand_confirm_ends_due":
    case "cleared_ruled":
    case "fix_window_ends_due":
    case "brand_accepted":
    case "brand_accept_ends_due":
    case "deadline_due":
    case "day_28_due":
      return afterPublishingTransition(state, event, settings);
    case "capture_started":
    case "capture_retry_due":
    case "capture_answered":
      return captureTransition(state, event, settings);
    case "payout_started":
    case "payout_retry_requested":
    case "payout_answered":
      return payoutTransition(state, event);
    case "cancel_requested":
      return cancelTransition(state, event);
  }
}
