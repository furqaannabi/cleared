import type { ItemStatus } from "@/lib/checklist/item-status";
import type { ChecklistItem, Deliverable } from "./types";

/** DC-FR-48: what the latest run changed, for the summary panel. */
export interface RunChange {
  heading: "Your fix worked" | "Your fix worked, but something changed" | "Something changed in this draft";
  /** Pass seal only when something was fixed and nothing got worse. */
  tone: "pass" | "neutral";
  lines: string[];
  stillNeedsYou: string | null;
  showing: string;
}

// Higher is better; a drop is "worse". Accepted by brand is handled as a cancellation, not a drop.
const RANK: Partial<Record<ItemStatus, number>> = { fix_needed: 0, unsure: 1, waiting_for_brand: 1, passed: 2 };
const WAS: Partial<Record<ItemStatus, string>> = {
  passed: "passed before",
  unsure: "was unsure",
  waiting_for_brand: "was waiting for the brand",
};
const NOW: Partial<Record<ItemStatus, string>> = { fix_needed: "now needs fixing", unsure: "is now unsure" };

/** "A", "A and B", "A, B and C", "A, B, C and 2 more". */
function names(items: ChecklistItem[]): string {
  const shown = items.slice(0, 3).map((i) => i.name);
  const more = items.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

function changed(d: Deliverable) {
  const moved = d.items.filter((i) => i.previousStatus && i.previousStatus !== i.status);
  return {
    moved,
    fixed: moved.filter((i) => i.status === "passed"),
    cancelled: moved.filter((i) => i.previousStatus === "accepted_by_brand" && i.status === "unsure"),
    worse: moved.filter((i) => {
      const was = RANK[i.previousStatus!];
      const now = RANK[i.status];
      return was != null && now != null && now < was && NOW[i.status] != null;
    }),
  };
}

const fixedLine = (fixed: ChecklistItem[]) => `${names(fixed)} ${fixed.length === 1 ? "now passes" : "now pass"}.`;

/**
 * What the latest run changed since the one before (DC-FR-48), from each
 * item's `previousStatus`: what got fixed, what got worse (said plainly, never
 * hidden behind good news), and acceptances the new draft cancelled (DC-BR-04).
 * Results state only, from run 2 on, and only when something changed.
 *
 * @param d - the deliverable
 * @returns the summary, or null
 * @see docs/specs/creator-draft-check-frd.md DC-FR-48, DC-FR-19, DC-BR-04
 */
export function runChange(d: Deliverable): RunChange | null {
  if (d.state !== "results" || (d.run ?? 1) < 2) return null;
  const { moved, fixed, cancelled, worse } = changed(d);
  if (moved.length === 0) return null;

  const lines: string[] = [];
  if (fixed.length) lines.push(fixedLine(fixed));
  for (const i of worse.slice(0, 3)) lines.push(`${i.name} ${WAS[i.previousStatus!]} and ${NOW[i.status]}.`);
  if (worse.length > 3) lines.push(`${worse.length - 3} more ${worse.length - 3 === 1 ? "item" : "items"} got worse.`);
  for (const i of cancelled.slice(0, 3)) {
    lines.push(`${d.brandName}’s acceptance of ${i.name} was cancelled by the new draft, so it’s unsure again.`);
  }

  const needs = d.items.filter((i) => i.status === "fix_needed" || i.status === "unsure").length;
  return {
    heading: fixed.length ? (worse.length ? "Your fix worked, but something changed" : "Your fix worked") : "Something changed in this draft",
    tone: fixed.length && !worse.length ? "pass" : "neutral",
    lines,
    stillNeedsYou: needs ? `${needs} ${needs === 1 ? "item still needs" : "items still need"} you.` : null,
    showing: `Below are your results from run ${d.run}.`,
  };
}

/**
 * DC-FR-48 in the fully passing state: one line for the passed banner naming
 * what the latest run fixed, or null on run 1 or when nothing was fixed.
 */
export function fixedLineForPassed(d: Deliverable): string | null {
  if ((d.run ?? 1) < 2) return null;
  const { fixed } = changed(d);
  return fixed.length ? `Your fix worked: ${fixedLine(fixed)}` : null;
}
