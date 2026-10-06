import { describeStatus, type ItemStatus } from "@/lib/checklist/item-status";
import { Seal } from "@/components/ui/seal";
import { StatusIcon } from "@/components/ui/status-icon";
import { TONE_CLASSES } from "./tone";

/**
 * A checklist item's status as a seal: its tone's wash with the status icon
 * inside. Used on timeline markers, grid rows and item cards. Decorative.
 *
 * @param status - the item's status
 * @param className - size classes, "size-7" by default
 * @see docs/specs/creator-draft-check-frd.md DC-FR-13
 */
export function StatusSeal({ status, className }: { status: ItemStatus; className?: string }) {
  // The brand name only changes the word, which a seal doesn't show.
  const { icon, tone } = describeStatus(status, "");
  const { sealFill, ink } = TONE_CLASSES[tone];
  return (
    <Seal fillClassName={sealFill} className={className}>
      <StatusIcon name={icon} strokeWidth={3.4} className={`size-full ${ink}`} />
    </Seal>
  );
}
