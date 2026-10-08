/**
 * Provisional: follows the creator draft check FRD's mock shape until the
 * API contract exists, then moves to `contract/`.
 */
export const ITEM_STATUSES = [
  "not_checked",
  "checking",
  "passed",
  "fix_needed",
  "unsure",
  "at_live_check",
  "waiting_for_brand",
  "accepted_by_brand",
  // DC-FR-49: the check passed it; the brand objected in the review window.
  "objected_by_brand",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type StatusIcon = "check" | "cross" | "question" | "clock" | "spinner" | "check-circle" | "dot" | "flag";

/** Names a DESIGN.md colour pair; components map it to tokens. */
export type StatusTone = "pass" | "fail" | "unsure" | "waiting" | "accepted" | "none";

export interface StatusPresentation {
  label: string;
  icon: StatusIcon;
  tone: StatusTone;
}

export type ChecklistTab = "all" | "needs_you" | "passed" | "waiting_for_brand" | "at_live_check";

/** One row per status: the single mapping DC-FR-13 asks for. */
const STATUS_MAP: Record<
  ItemStatus,
  { label: (brandName: string) => string; icon: StatusIcon; tone: StatusTone; tab: ChecklistTab | null }
> = {
  not_checked: { label: () => "Not checked yet", icon: "dot", tone: "none", tab: null },
  checking: { label: () => "Checking", icon: "spinner", tone: "waiting", tab: null },
  passed: { label: () => "Passed", icon: "check", tone: "pass", tab: "passed" },
  fix_needed: { label: () => "Fix needed", icon: "cross", tone: "fail", tab: "needs_you" },
  unsure: { label: () => "Unsure", icon: "question", tone: "unsure", tab: "needs_you" },
  at_live_check: { label: () => "At live check", icon: "clock", tone: "waiting", tab: "at_live_check" },
  waiting_for_brand: { label: (b) => `Waiting for ${b}`, icon: "clock", tone: "unsure", tab: "waiting_for_brand" },
  accepted_by_brand: { label: (b) => `Accepted by ${b}`, icon: "check-circle", tone: "accepted", tab: "passed" },
  objected_by_brand: { label: (b) => `${b} objected`, icon: "flag", tone: "fail", tab: "needs_you" },
};

/**
 * How a checklist item's status is shown: its word, icon and colour tone.
 * Every rendering reads this (grid, cards, timeline, evidence panel).
 *
 * @param status - the item's status
 * @param brandName - the deal's brand, named in some words
 * @returns the label, icon and tone for the status
 * @see docs/specs/creator-draft-check-frd.md DC-FR-13
 */
export function describeStatus(status: ItemStatus, brandName: string): StatusPresentation {
  const { label, icon, tone } = STATUS_MAP[status];
  return { label: label(brandName), icon, tone };
}

/**
 * The checklist filter tabs an item with this status appears under.
 *
 * @param status - the item's status
 * @returns every tab the item belongs to, always including "all"
 * @see docs/specs/creator-draft-check-frd.md DC-FR-20
 */
export function tabsFor(status: ItemStatus): ChecklistTab[] {
  const { tab } = STATUS_MAP[status];
  return tab ? ["all", tab] : ["all"];
}

/** What needs the creator first, then what waits on others, then what is settled. */
export const NEED_ORDER: ItemStatus[] = [
  "objected_by_brand",
  "fix_needed",
  "unsure",
  "waiting_for_brand",
  "checking",
  "not_checked",
  "accepted_by_brand",
  "passed",
  "at_live_check",
];

/**
 * Items sorted so what needs the creator comes first (a stable sort, so brief
 * order is kept within each status). Used for phone cards and the grid's
 * Result sort.
 *
 * @param items - anything with a status
 */
export function byNeed<T extends { status: ItemStatus }>(items: T[]): T[] {
  return [...items].sort((a, b) => NEED_ORDER.indexOf(a.status) - NEED_ORDER.indexOf(b.status));
}
