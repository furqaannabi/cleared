import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { useChecklistWords } from "./checklist-words";

/**
 * On an item the brand objected to (DC-FR-49): "The check passed this.
 * {brand} asked you to change it:" and the note. On an Unsure item the brand declined: "{brand} asked you to fix this" and
 * the brand's note, as plain text. Sits above the evidence, so the brand's own
 * words come before Sponing's suggestion. Renders nothing otherwise. On the
 * brand's review the brand's own words: "You objected:" (RW-FR-08).
 *
 * @param item - the item; shown only when it is Unsure and declined
 * @param brandName - the deal's brand
 * @see docs/specs/creator-draft-check-frd.md DC-FR-17, DC-FR-46, DC-BR-09; DESIGN.md "Cards / Containers"
 */
export function BrandNote({ item, brandName }: { item: ItemView; brandName: string }) {
  const words = useChecklistWords(brandName);
  if (item.status === "objected_by_brand")
    return (
      <div className="rounded-sm bg-fail-tint px-3 py-2.5 text-[14px] text-ink">
        <p className="text-label font-bold text-fail">{words.objected}</p>
        {item.brandNote && <p className="mt-0.5">“{item.brandNote}”</p>}
      </div>
    );
  if (!item.declined || item.status !== "unsure") return null;
  return (
    <div className="rounded-sm bg-unsure-wash px-3 py-2.5 text-[14px] text-ink">
      <p className="text-label font-bold text-unsure">{words.fixAsked}</p>
      {item.brandNote && <p className="mt-0.5">“{item.brandNote}”</p>}
    </div>
  );
}
