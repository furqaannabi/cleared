import { formatDay, formatTime } from "./format";
import type { Deliverable } from "./types";

export interface DeadlineView {
  /** "24 Oct", always in the creator's timezone. */
  date: string;
  /** "ends 18:59 your time", or null when the viewer's time matches the creator's. */
  yourTime: string | null;
}

/**
 * A deadline as everyone reads it: one shared date in the creator's
 * timezone, plus when it ends for the viewer if their local time differs.
 *
 * @param d - the deliverable, with its deadline and the creator's timezone
 * @param viewerTimeZone - the viewer's timezone; the runtime's when omitted
 * @see docs/specs/creator-draft-check-frd.md DC-FR-44; docs/decisions/2026-10-06-deadline-shared-date-with-local-time.md
 */
export function deadlineView(d: Deliverable, viewerTimeZone?: string): DeadlineView {
  const date = formatDay(d.deadline, d.creatorTimeZone);
  const viewerDate = formatDay(d.deadline, viewerTimeZone);
  const viewerTime = formatTime(d.deadline, viewerTimeZone);
  // Compare the local clock readings, so zones that agree at that moment count as the same.
  if (viewerDate === date && viewerTime === formatTime(d.deadline, d.creatorTimeZone)) return { date, yourTime: null };
  const when = viewerDate === date ? viewerTime : `${viewerDate}, ${viewerTime}`;
  return { date, yourTime: `ends ${when} your time` };
}

/** "Post by 24 Oct." or "Post by 24 Oct (ends 18:59 your time)." */
export function postBy(view: DeadlineView): string {
  return `Post by ${view.date}${view.yourTime ? ` (${view.yourTime})` : ""}.`;
}
