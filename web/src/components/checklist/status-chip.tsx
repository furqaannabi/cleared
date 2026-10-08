import { describeStatus, type ItemStatus } from "@/lib/checklist/item-status";
import { StatusIcon } from "@/components/ui/status-icon";
import { TONE_CLASSES } from "./tone";

/**
 * A checklist item's result as a pill: icon plus word, in its tone's
 * colours. Used in the grid, on item cards and in the evidence panel.
 *
 * @param status - the item's status
 * @param brandName - the deal's brand, named in "Waiting for …" and "Accepted by …"
 * @param label - the word to show instead of the creator's (the brand's review, RW-FR-08)
 * @see docs/specs/creator-draft-check-frd.md DC-FR-13
 */
export function StatusChip({ status, brandName, label: word }: { status: ItemStatus; brandName: string; label?: string }) {
  const { label: own, icon, tone } = describeStatus(status, brandName);
  const label = word ?? own;
  const { wash, ink } = TONE_CLASSES[tone];
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill py-1 pr-2.5 pl-2 text-chip font-bold ${wash} ${ink}`}
    >
      <StatusIcon name={icon} className="size-3.5" strokeWidth={2.6} />
      {label}
    </span>
  );
}
