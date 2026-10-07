import { describeStatus, tabsFor, type ChecklistTab, type ItemStatus } from "@/lib/checklist/item-status";
import { deadlineView, type DeadlineView } from "./deadline";
import { dealSteps, type DealStepsView } from "./deal-steps";
import { formatAgo, formatDay, formatDuration } from "./format";
import { nextStep, type NextStep } from "./next-step";
import type { ChecklistItem, Deliverable } from "./types";

export interface TabView {
  id: ChecklistTab;
  label: string;
  count: number;
}

export interface DeliverableView {
  /** DC-FR-32: "Glow Theory · YouTube video". */
  title: string;
  /** "YouTube video", "YouTube Short" or "Instagram Reel". */
  deliverableName: string;
  tabs: TabView[];
  /** The item selected when the page opens, if the URL names none. */
  defaultItemId: string | null;
  items: ItemView[];
  /** DC-FR-11: leads the next-step bar when the deadline is close, else null. */
  deadlineWarning: string | null;
  nextStep: NextStep;
  /** DC-FR-44: the shared date, and when it ends for the viewer if their time differs. */
  deadline: DeadlineView;
  /** DC-FR-32: the header's details line, e.g. ["Draft check, run 2", "6:48 long", "Post by 24 Oct"]. */
  meta: string[];
  /** DC-FR-34: the deal steps. */
  steps: DealStepsView;
}

export interface ItemView extends ChecklistItem {
  /** DC-FR-19: "Was Fix needed", or null when nothing changed. */
  change: string | null;
  /** DC-FR-14, DC-FR-15: what the creator can do about this item here, if anything. */
  action: "ask" | "withdraw" | null;
  /** DC-FR-15: "2 hours ago" for an item waiting on the brand, else null. */
  asked: string | null;
}

const PLATFORM_NAME: Record<Deliverable["platform"], string> = {
  youtube_video: "YouTube video",
  youtube_short: "YouTube Short",
  instagram_reel: "Instagram Reel",
};

const TAB_ORDER: ChecklistTab[] = ["all", "needs_you", "passed", "waiting_for_brand", "at_live_check"];

function tabLabel(tab: ChecklistTab, brandName: string): string {
  switch (tab) {
    case "all":
      return "All";
    case "needs_you":
      return "Needs you";
    case "passed":
      return "Passed";
    case "waiting_for_brand":
      return `Waiting for ${brandName}`;
    case "at_live_check":
      return "At live check";
  }
}

function checklistTabs(d: Deliverable): TabView[] {
  if (d.state === "checking" || d.state === "no_draft") return [];
  const count = (tab: ChecklistTab) => d.items.filter((i) => tabsFor(i.status).includes(tab)).length;
  return TAB_ORDER.map((id) => ({ id, label: tabLabel(id, d.brandName), count: count(id) })).filter(
    (t) => t.id !== "waiting_for_brand" || t.count > 0,
  );
}

function defaultItemId(d: Deliverable): string | null {
  const first =
    d.items.find((i) => i.status === "fix_needed") ?? d.items.find((i) => i.status === "unsure") ?? d.items[0];
  return first?.id ?? null;
}

// Brand statuses read as a sentence ("Was accepted by …"); the rest keep their status name.
const SENTENCE_CASE: ItemStatus[] = ["waiting_for_brand", "accepted_by_brand"];

function changeSinceLastRun(item: ChecklistItem, brandName: string): string | null {
  const { status, previousStatus } = item;
  if (!previousStatus || previousStatus === status) return null;
  if (status === "checking" || status === "not_checked") return null;
  const label = describeStatus(previousStatus, brandName).label;
  return `Was ${SENTENCE_CASE.includes(previousStatus) ? label[0].toLowerCase() + label.slice(1) : label}`;
}

// DC-FR-14 to DC-FR-18, DC-BR-02: the API's `askable` is the authority, and a
// Fix needed item is never offered an ask whatever it says.
function itemAction(item: ChecklistItem, d: Deliverable): ItemView["action"] {
  if (d.state === "released") return null;
  if (item.status === "waiting_for_brand") return "withdraw";
  if (item.status === "unsure" && item.askable && !item.declined) return "ask";
  return null;
}

const HOUR_MS = 3_600_000;
const WARN_STATES: Deliverable["state"][] = ["no_draft", "results", "check_failed"];

function deadlineWarning(d: Deliverable, now: Date): string | null {
  if (!WARN_STATES.includes(d.state)) return null;
  const hoursLeft = (Date.parse(d.deadline) - now.getTime()) / HOUR_MS;
  if (hoursLeft >= 72 || hoursLeft <= 0) return null;
  const days = Math.floor(hoursLeft / 24);
  if (days === 0) return "Less than a day left to post.";
  return `${days} ${days === 1 ? "day" : "days"} left to post.`;
}

function headerMeta(d: Deliverable, deadline: DeadlineView, timeZone?: string): string[] {
  if (d.state === "released") {
    return [d.releasedAt ? `Ended ${formatDay(d.releasedAt, timeZone)}` : "Ended", `Was due ${deadline.date}`];
  }
  const postBy = `Post by ${deadline.date}`;
  if (d.state === "no_draft") return ["No draft yet", postBy];
  return [
    `Draft check, run ${d.run ?? 1}`,
    ...(d.draft ? [`${formatDuration(d.draft.durationSec)} long`] : []),
    postBy,
  ];
}

// DC-FR-11: the deadline warning leads the next-step bar.
function leadWith(warning: string | null, step: NextStep): NextStep {
  return warning ? { ...step, lead: `${warning} ${step.lead}` } : step;
}

/**
 * Everything the creator's draft check page shows for one deliverable,
 * worked out from the API's data. It never decides the deliverable's state,
 * the review window or anything about money; it only presents them.
 *
 * @param d - the deliverable as the API returns it
 * @param now - the current time, passed in so time rules can be tested
 * @param options.timeZone - the viewer's timezone for dates; the runtime's when omitted
 * @returns the page's view
 * @see docs/specs/creator-draft-check-frd.md
 */
export function deliverableView(d: Deliverable, now: Date, options: { timeZone?: string } = {}): DeliverableView {
  const warning = deadlineWarning(d, now);
  return {
    title: `${d.brandName} · ${PLATFORM_NAME[d.platform]}`,
    deliverableName: PLATFORM_NAME[d.platform],
    tabs: checklistTabs(d),
    defaultItemId: defaultItemId(d),
    items: d.items.map((i) => ({
      ...i,
      change: changeSinceLastRun(i, d.brandName),
      action: itemAction(i, d),
      asked: i.status === "waiting_for_brand" && i.askedAt ? formatAgo(i.askedAt, now) : null,
    })),
    deadlineWarning: warning,
    nextStep: leadWith(warning, nextStep(d, options.timeZone)),
    deadline: deadlineView(d, options.timeZone),
    meta: headerMeta(d, deadlineView(d, options.timeZone), options.timeZone),
    steps: dealSteps(d),
  };
}
