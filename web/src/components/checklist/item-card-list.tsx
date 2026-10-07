import { byNeed } from "@/lib/checklist/item-status";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { ItemCard } from "./item-card";

/**
 * The checklist as a stack of item cards (phones), what needs the creator
 * first. The open card is the selected item; tapping it again closes it.
 *
 * @param items - the checklist items to show
 * @param brandName - the deal's brand, for result words
 * @param selectedId - the selected item, or null
 * @param onSelect - called with the item to select, or null to close
 * @param renderActions - the actions for an item, shown inside its open card
 * @see docs/specs/creator-draft-check-frd.md DC-FR-12, DC-FR-22
 */
export function ItemCardList({
  items,
  brandName,
  selectedId,
  onSelect,
  renderActions,
}: {
  items: ItemView[];
  brandName: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  renderActions?: (item: ItemView) => React.ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {byNeed(items).map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          brandName={brandName}
          expanded={item.id === selectedId}
          onToggle={() => onSelect(item.id === selectedId ? null : item.id)}
          actions={renderActions?.(item)}
        />
      ))}
    </ul>
  );
}
