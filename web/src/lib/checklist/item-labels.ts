import { formatDuration } from "@/lib/deliverable/format";
import type { ChecklistItem } from "@/lib/deliverable/types";

const KIND: Record<ChecklistItem["kind"], string> = {
  said: "Said",
  shown_as_text: "Shown as text",
  shown: "Shown",
  timing: "Timing",
  written: "Written",
  disclosure: "Disclosure",
  publication: "Publication",
};

const CHECKED_BY: Record<ChecklistItem["checkedBy"], string> = {
  exact_match: "Exact match",
  ai_timestamp: "AI, with a timestamp",
  from_timestamps: "Worked out from the timestamps",
  published_post: "Checked on the published post",
  platform_record: "The platform’s record of the post",
};

/** The item's kind in plain words: "Shown as text". */
export const kindLabel = (kind: ChecklistItem["kind"]) => KIND[kind];

/** How the item was checked, in plain words: "Exact match". */
export const checkedByLabel = (checkedBy: ChecklistItem["checkedBy"]) => CHECKED_BY[checkedBy];

/** The item's moment in the draft: "3:15", "0:42–1:38", or null if it has none. */
export function itemTime(item: ChecklistItem): string | null {
  const start = item.evidence?.startSec;
  if (start == null) return null;
  const end = item.evidence?.endSec;
  return end != null ? `${formatDuration(start)}–${formatDuration(end)}` : formatDuration(start);
}
