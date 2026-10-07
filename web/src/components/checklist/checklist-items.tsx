"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { ItemCardList } from "./item-card-list";

// Loaded only when the screen is md: or wider, so phones never download AG Grid.
const ChecklistGrid = dynamic(() => import("./checklist-grid"), { ssr: false });

/** Tailwind's default `md:` breakpoint. */
const MD = "(min-width: 768px)";

/**
 * The checklist items in the right form for the screen: AG Grid from `md:`
 * up, item cards below. Both come from the same items (DC-FR-41) and share
 * one selection (DC-FR-22).
 *
 * @param items - the checklist items to show
 * @param brandName - the deal's brand, for result words
 * @param selectedId - the selected item, or null
 * @param onSelect - called with the item to select, or null to close a card
 * @see docs/specs/creator-draft-check-frd.md DC-FR-40; docs/decisions/2026-10-06-evidence-view-ag-grid.md
 */
export function ChecklistItems(props: {
  items: ItemView[];
  brandName: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  renderActions?: (item: ItemView) => React.ReactNode;
}) {
  const wide = useMediaQuery(MD);
  const { renderActions, ...gridProps } = props;
  // On wider screens the actions live in the evidence panel, not the grid.
  void renderActions;
  return wide ? <ChecklistGrid {...gridProps} onSelect={(id: string) => props.onSelect(id)} /> : <ItemCardList {...props} />;
}
