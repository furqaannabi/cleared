import type { StatusTone } from "@/lib/checklist/item-status";

/**
 * Each status tone's DESIGN.md colour pair, as Tailwind classes. The only
 * place a tone becomes a colour. Green (`pass`) is for Passed only, and the
 * brand colours never stand in for a status, except the espresso icon that
 * marks an item a person accepted.
 *
 * @see DESIGN.md "State" and "The Brand Is Not A Status Rule"
 */
export const TONE_CLASSES: Record<StatusTone, { wash: string; ink: string; sealFill: string }> = {
  pass: { wash: "bg-pass-wash", ink: "text-pass", sealFill: "fill-pass-wash" },
  fail: { wash: "bg-fail-wash", ink: "text-fail", sealFill: "fill-fail-wash" },
  unsure: { wash: "bg-unsure-wash", ink: "text-unsure", sealFill: "fill-unsure-wash" },
  waiting: { wash: "bg-waiting-wash", ink: "text-waiting", sealFill: "fill-waiting-wash" },
  accepted: { wash: "bg-waiting-wash", ink: "text-espresso", sealFill: "fill-waiting-wash" },
  none: { wash: "bg-transparent", ink: "text-ink-4", sealFill: "fill-line-soft" },
};
