import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { SHARED } from "./brand-status";
import type { BrandReviewView } from "./review-view";

/**
 * The brand's items in the shape the shared checklist (grid, cards, evidence
 * panel, timeline) reads, with the creator's status for icons and colours.
 * Nothing only for the creator is carried over: no change since the last run,
 * no suggested fix, no creator actions (RW-BR-06).
 *
 * @param items - the brand review view's items
 * @see docs/specs/brand-review-frd.md RW-FR-07 to RW-FR-09
 */
export function toItemViews(items: BrandReviewView["items"]): ItemView[] {
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    checkedBy: i.checkedBy,
    status: SHARED[i.status.value],
    ...(i.briefLine ? { briefLine: i.briefLine } : {}),
    ...(i.evidence ? { evidence: i.evidence } : {}),
    change: null,
    action: null,
    asked: null,
    suggestedFix: null,
  }));
}
