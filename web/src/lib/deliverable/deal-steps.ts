import type { Deliverable } from "./types";

export const DEAL_STEPS = ["Checklist agreed", "Held", "Draft check", "Brand review", "Publish", "Live check", "Paid"] as const;

export interface DealStepsView {
  items: { label: (typeof DEAL_STEPS)[number]; state: "done" | "current" | "upcoming" | "ended" }[];
  /** For phones: "Step 3 of 7 · Draft check", or "Ended · hold released". */
  summary: string;
}

/** Which deal step each page state is at (the page states in this FRD reach Publish once approved, DC-FR-51). */
const CURRENT: Record<Exclude<Deliverable["state"], "released" | "paid" | "approved_not_paid">, number> = {
  no_draft: 2,
  checking: 2,
  results: 2,
  check_failed: 2,
  fully_passing: 3,
  objected: 3,
  approved: 4,
  // PP-FR-24
  posting: 4,
  published: 5,
  captured: 6,
};

/**
 * The seven deal steps with done, current and upcoming marked, from the
 * state the API reports. A released deliverable has ended after Held.
 *
 * @see docs/specs/creator-draft-check-frd.md DC-FR-34
 */
export function dealSteps(d: Deliverable): DealStepsView {
  if (d.state === "released") {
    return {
      items: DEAL_STEPS.map((label, i) => ({ label, state: i < 2 ? "done" : "ended" })),
      summary: "Ended · hold released",
    };
  }
  // PP-FR-24: paid has every step done; approved, not paid ends before Paid.
  if (d.state === "paid") return { items: DEAL_STEPS.map((label) => ({ label, state: "done" })), summary: "Cleared · paid" };
  if (d.state === "approved_not_paid") {
    return { items: DEAL_STEPS.map((label, i) => ({ label, state: i < 6 ? "done" : "ended" })), summary: "Ended · approved, not paid" };
  }
  const current = CURRENT[d.state];
  return {
    items: DEAL_STEPS.map((label, i) => ({ label, state: i < current ? "done" : i === current ? "current" : "upcoming" })),
    summary: `Step ${current + 1} of ${DEAL_STEPS.length} · ${DEAL_STEPS[current]}`,
  };
}

/** A deliverable's step in a few words, for the switcher: "Draft check", "Brand review", "Hold released". */
export function stepLabel(state: Deliverable["state"]): string {
  if (state === "released") return "Hold released";
  if (state === "no_draft") return "Waiting for your draft";
  if (state === "paid") return "Paid";
  if (state === "approved_not_paid") return "Approved, not paid";
  return DEAL_STEPS[CURRENT[state]];
}
