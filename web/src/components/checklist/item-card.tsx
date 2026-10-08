import { checkedByLabel, itemTime, kindLabel } from "@/lib/checklist/item-labels";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { PlayFrom } from "@/components/player/seek";
import { BrandNote } from "./brand-note";
import { useChecklistWords } from "./checklist-words";
import { StatusChip } from "./status-chip";
import { StatusSeal } from "./status-seal";

/**
 * One checklist item as a card (phones): a button row with its seal, name,
 * kind and time, and result. Expanded, it shows the evidence, the brief line
 * it came from, how it was checked and what changed since the last run.
 *
 * @param item - the item, with its change since the last run
 * @param brandName - the deal's brand, for the result word
 * @param expanded - whether the card is open (it is the selected item)
 * @param onToggle - called when the creator taps the row
 * @param actions - what the creator can do about the item, shown when expanded
 * @see docs/specs/creator-draft-check-frd.md DC-FR-12, DC-FR-22, DC-FR-46
 */
export function ItemCard({
  item,
  brandName,
  expanded,
  onToggle,
  actions,
}: {
  item: ItemView;
  brandName: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  const words = useChecklistWords(brandName);
  const time = itemTime(item);
  const meta = time ? `${kindLabel(item.kind)} · ${time}` : kindLabel(item.kind);
  return (
    <li
      id={`item-${item.id}`}
      className={`scroll-mt-20 scroll-mb-40 overflow-hidden rounded-md border ${item.status === "fix_needed" ? "border-fail-line bg-fail-tint" : "border-line bg-surface"}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="grid min-h-[60px] w-full grid-cols-[30px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3 text-left"
      >
        <StatusSeal status={item.status} className="mt-0.5 size-[30px]" />
        <span className="flex flex-col gap-1.5">
          <b className="text-body-strong font-bold">{item.name}</b>
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="text-chip text-ink-3">{meta}</span>
            <StatusChip status={item.status} brandName={brandName} label={words.status(item)} />
          </span>
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5 pl-[58px] text-[14px] text-ink-2">
          {item.change && (
            <span className="inline-flex items-center gap-1.5 text-label font-semibold text-ink-3">
              <HistoryIcon />
              {item.change}
            </span>
          )}
          <BrandNote item={item} brandName={brandName} />
          {item.evidence && (
            <p className={`rounded-sm px-3 py-2.5 text-ink ${item.status === "fix_needed" ? "bg-surface" : "bg-latte-wash"}`}>
              {item.evidence.text}
            </p>
          )}
          <PlayFrom itemId={item.id} startSec={item.evidence?.startSec} />
          {/* DC-FR-46: advice in plain text; the next draft check still decides. */}
          {item.suggestedFix && (
            <div className="rounded-sm border border-line-soft bg-surface px-3 py-2.5 text-ink">
              <p className="text-label font-bold text-ink-3">Suggested fix</p>
              <p className="mt-0.5">{item.suggestedFix}</p>
            </div>
          )}
          <p>{item.briefLine ? `Brief line ${item.briefLine.number}: “${item.briefLine.text}”` : words.addedBy}</p>
          <p className="text-meta text-ink-3">Checked by: {checkedByLabel(item.checkedBy)}</p>
          {actions && <div className="mt-1">{actions}</div>}
        </div>
      )}
    </li>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[13px]">
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
