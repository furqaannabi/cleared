import type { StatusPresentation } from "@/lib/checklist/item-status";
import { formatDay, formatDayTime, itemCount } from "@/lib/deliverable/format";
import { formatAmount } from "@/lib/invite/amount";
import { describeBrandStatus } from "./brand-status";
import type { BrandDeliverable, BrandItem } from "./types";

/** What the brand's review page shows for one post, worked out once from the API's data. */
export interface BrandReviewView {
  state: BrandDeliverable["review"]["state"];
  /** RW-FR-11: what happens next and who acts. */
  next: { lead: string; detail: string };
  /** RW-FR-15, RW-FR-19: the window's time left. */
  timeLeft: { text: string; lastHour: boolean } | null;
  warning: string | null;
  actions: { approve: boolean; object: boolean; answer: boolean; approveAnyway: boolean };
  /** RW-FR-07, RW-FR-08: the latest draft's items, each with its status in the brand's words. */
  items: (Omit<BrandItem, "status"> & { status: StatusPresentation & { value: BrandItem["status"] } })[];
  /** RW-FR-12: the item selected on load; null when there is no draft to show. */
  selectedId: string | null;
}

const HOUR = 3_600_000;
const NONE = { approve: false, object: false, answer: false, approveAnyway: false };

/** "31h 12m", or "42m" under an hour. */
function left(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/**
 * The brand's review of one post, from the state the API reports. It never
 * decides when the window starts or ends (RW-BR-01).
 *
 * @param d - the post as the brand sees it
 * @param now - the current time, for the time left
 * @param options.timeZone - the viewer's timezone for dates
 * @see docs/specs/brand-review-frd.md RW-FR-06 to RW-FR-24
 */
export function brandReviewView(d: BrandDeliverable, now: Date, { timeZone }: { timeZone?: string } = {}): BrandReviewView {
  const c = d.creatorName;
  const raw = d.draft?.items ?? [];
  const items = raw.map((i) => ({ ...i, status: { ...describeBrandStatus(i.status, c), value: i.status } }));
  const first = (s: BrandItem["status"]) => raw.find((i) => i.status === s)?.id;
  const selectedId = first("asked") ?? first("objected") ?? raw[0]?.id ?? null;
  const base = { items, selectedId, timeLeft: null, warning: null, actions: NONE };
  // DC-FR-44: the deadline's date is the creator's, shared by both sides.
  const postBy = formatDay(d.hold.deadline, d.creatorTimeZone);
  const amount = formatAmount(d.hold.amount);
  const r = d.review;

  switch (r.state) {
    case "nothing_yet":
      return { ...base, state: r.state, next: { lead: `${c} is working on the draft.`, detail: "You’ll get a link when there’s something to review." } };
    case "asked": {
      const asked = raw.filter((i) => i.status === "asked").length;
      return asked
        ? { ...base, state: r.state, actions: { ...NONE, answer: true }, next: { lead: `${c} asked you to accept ${itemCount(asked)}.`, detail: "Nothing else needs you until every item passes." } }
        : { ...base, state: r.state, next: { lead: `You answered ${c}.`, detail: `${c} is working on the rest of the draft. You’ll get a link when every item passes.` } };
    }
    case "window": {
      const ms = Date.parse(r.endsAt) - now.getTime();
      const lastHour = ms < HOUR;
      return {
        ...base,
        state: r.state,
        next: { lead: `Every item passed. You have until ${formatDayTime(r.endsAt, timeZone)} to review.`, detail: "If you say nothing, the draft is approved." },
        timeLeft: { text: left(ms), lastHour },
        warning: lastHour ? "Less than an hour left to object." : null,
        actions: { ...NONE, approve: true, object: true },
      };
    }
    case "objected": {
      const n = raw.filter((i) => i.status === "objected").length;
      return {
        ...base,
        state: r.state,
        actions: { ...NONE, approveAnyway: true },
        next: { lead: `You asked ${c} to fix ${itemCount(n)}.`, detail: `The clock has stopped. ${c} makes a new draft by ${postBy}; if ${c} doesn’t, the hold comes back to you.` },
      };
    }
    case "approved":
      return {
        ...base,
        state: r.state,
        next: {
          lead: r.by === "brand" ? `Approved by you · ${formatDay(r.approvedAt, timeZone)}` : "Approved · No objection in 48 hours",
          detail: `${c} posts by ${postBy}. Your ${amount} is taken only once the live post checks out.`,
        },
      };
    case "released":
      return {
        ...base,
        state: r.state,
        next: {
          lead: "The hold came back to you.",
          detail: `${r.reason === "deadline" ? `${c} didn’t post by the deadline` : "The deal was cancelled"}, so your ${amount} was released on ${formatDay(r.releasedAt, timeZone)}.`,
        },
      };
  }
}
