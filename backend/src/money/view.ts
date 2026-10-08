/** What the pages are shown of a deliverable's money (MP-FR-40). Built so far: the hold. */
import type { MoneyState } from "./types";

/**
 * One post's hold, in the states the confirm and hold spec shows (CH-FR-18).
 * pending covers both PayPal reviewing the hold and PayPal not having answered yet.
 */
export type HoldView =
  | { state: "not_started" | "closed" | "declined" | "pending" | "unknown" }
  | { state: "held"; reference: string; heldAt: Date; deadlineAt: Date };

export interface MoneyView {
  stage: MoneyState["stage"];
  hold: HoldView;
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
  return { stage: state.stage, hold: holdView(state) };
}
