"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { describeStatus, type ItemStatus } from "@/lib/checklist/item-status";

/** The words the checklist uses for an item's result and for an item with no brief line. */
export interface ChecklistWords {
  status: (item: { id: string; status: ItemStatus }) => string;
  /** In place of a brief line, on an item the creator added (DC-FR-12). */
  addedBy: string;
}

const WordsContext = createContext<ChecklistWords | null>(null);

/**
 * Lets the brand's review reuse the creator's checklist (grid, cards,
 * evidence panel, timeline) with its own words: "You objected", "Added by
 * Ada Okafor". Icons and colours stay the creator's, so both sides match.
 *
 * @param words - the status word per item, and what an added item says
 * @see docs/specs/brand-review-frd.md RW-FR-07 to RW-FR-09
 */
export function ChecklistWordsProvider({ words, children }: { words: ChecklistWords; children: ReactNode }) {
  return <WordsContext.Provider value={words}>{children}</WordsContext.Provider>;
}

/**
 * The checklist's words: the provider's, or the creator's own (DC-FR-13).
 *
 * @param brandName - the deal's brand, named in the creator's words
 */
export function useChecklistWords(brandName: string): ChecklistWords {
  const own = useMemo<ChecklistWords>(() => ({ status: (i) => describeStatus(i.status, brandName).label, addedBy: "Added by you" }), [brandName]);
  return useContext(WordsContext) ?? own;
}
