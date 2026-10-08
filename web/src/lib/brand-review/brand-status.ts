import { describeStatus, type ItemStatus, type StatusPresentation } from "@/lib/checklist/item-status";
import type { BrandItemStatus } from "./types";

/** Each brand status borrows the creator's icon and colour, so the two sides never differ (DC-FR-13). */
export const SHARED: Record<BrandItemStatus, ItemStatus> = {
  passed: "passed",
  fix_needed: "fix_needed",
  unsure: "unsure",
  at_live_check: "at_live_check",
  asked: "waiting_for_brand",
  accepted: "accepted_by_brand",
  fix_requested: "unsure",
  objected: "objected_by_brand",
};

const WORD: Record<BrandItemStatus, (creator: string) => string> = {
  passed: () => "Passed",
  fix_needed: (c) => `${c} is fixing this`,
  unsure: () => "Unsure",
  at_live_check: () => "At live check",
  asked: (c) => `${c} asked you`,
  accepted: () => "You accepted",
  fix_requested: () => "You asked for a fix",
  objected: () => "You objected",
};

/**
 * How an item's status reads on the brand's page: its own word, the
 * creator's icon and colour. Only Passed is green.
 *
 * @param status - the item's status for the brand
 * @param creatorName - the creator, named in some words
 * @see docs/specs/brand-review-frd.md RW-FR-08
 */
export function describeBrandStatus(status: BrandItemStatus, creatorName: string): StatusPresentation {
  return { ...describeStatus(SHARED[status], ""), label: WORD[status](creatorName) };
}
