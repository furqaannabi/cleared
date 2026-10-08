import { BrandNote } from "@/components/checklist/brand-note";
import { PlayFrom } from "@/components/player/seek";
import { useChecklistWords } from "@/components/checklist/checklist-words";
import { StatusChip } from "@/components/checklist/status-chip";
import { StatusSeal } from "@/components/checklist/status-seal";
import { checkedByLabel, itemTime, kindLabel } from "@/lib/checklist/item-labels";
import type { ItemView } from "@/lib/deliverable/deliverable-view";

/**
 * The selected checklist item in full (tablet and up): its result and any
 * change since the last run, its evidence, the brief line it came from and
 * how it was checked. On phones the expanded item card does this job.
 *
 * @param item - the selected item, or null when none is selected
 * @param brandName - the deal's brand, for result words
 * @param actions - what the creator can do about the item (ask the brand, withdraw)
 * @see docs/specs/creator-draft-check-frd.md DC-FR-12, DC-FR-22, DC-FR-46; DESIGN.md "Cards / Containers"
 */
export function EvidencePanel({
  item,
  brandName,
  actions,
}: {
  item: ItemView | null;
  brandName: string;
  actions?: React.ReactNode;
}) {
  const words = useChecklistWords(brandName);
  if (!item) {
    return (
      <section aria-label="Evidence" className="rounded-lg border border-line bg-surface px-[22px] py-5 text-ink-3 shadow-panel">
        Choose an item in the checklist to see its evidence and the brief line it came from.
      </section>
    );
  }
  const time = itemTime(item);
  const failed = item.status === "fix_needed";
  return (
    <section
      aria-label={`Evidence for ${item.name}`}
      className="rounded-lg border border-line bg-surface px-[22px] py-5 shadow-panel"
    >
      <div className="flex items-start gap-3">
        <StatusSeal status={item.status} className="mt-0.5 size-10" />
        <div className="min-w-0">
          <h2 className="text-item-title font-bold">{item.name}</h2>
          <p className="mt-0.5 text-meta text-ink-3">{time ? `${kindLabel(item.kind)} · ${time}` : kindLabel(item.kind)}</p>
        </div>
      </div>
      <div className="mt-4 empty:hidden">
        <BrandNote item={item} brandName={brandName} />
      </div>
      <dl className="mt-4 grid gap-3.5">
        <Field label="Result">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <StatusChip status={item.status} brandName={brandName} label={words.status(item)} />
            {item.change && <span className="text-label font-semibold text-ink-3">{item.change}</span>}
          </span>
        </Field>
        {item.evidence && (
          <Field label={item.evidence.label}>
            <p className={`rounded-sm px-3 py-2.5 ${failed ? "bg-fail-tint" : "bg-latte-wash"}`}>{item.evidence.text}</p>
            <span className="mt-2 flex">
              <PlayFrom itemId={item.id} startSec={item.evidence.startSec} />
            </span>
          </Field>
        )}
        {/* DC-FR-46: advice in plain text; the next draft check still decides. */}
        {item.suggestedFix && <Field label="Suggested fix">{item.suggestedFix}</Field>}
        <Field label="From the brief">
          <span className="flex items-start gap-2 text-ink-2">
            <BriefIcon />
            <span>{item.briefLine ? `Line ${item.briefLine.number}: “${item.briefLine.text}”` : words.addedBy}</span>
          </span>
        </Field>
        <Field label="Checked by">{checkedByLabel(item.checkedBy)}</Field>
      </dl>
      {actions && <div className="mt-4 border-t border-line-soft pt-4">{actions}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label font-bold tracking-[0.02em] text-ink-3">{label}</dt>
      <dd className="mt-1 text-body-strong font-normal text-ink">{children}</dd>
    </div>
  );
}

function BriefIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-[3px] size-4 flex-none text-ink-3"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8M16 17H8" />
    </svg>
  );
}
