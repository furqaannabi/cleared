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
  actions: { approve: boolean; object: boolean; answer: boolean; approveAnyway: boolean; confirmPost: boolean; acceptPost: boolean };
  /** RW-FR-07, RW-FR-08: the latest draft's items, each with its status in the brand's words. */
  items: (Omit<BrandItem, "status"> & { status: StatusPresentation & { value: BrandItem["status"] } })[];
  /** RW-FR-12: the item selected on load; null when there is no draft to show. */
  selectedId: string | null;
}

const HOUR = 3_600_000;
const NONE = { approve: false, object: false, answer: false, approveAnyway: false, confirmPost: false, acceptPost: false };

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
  const items = raw.map((i) => {
    const status = { ...describeBrandStatus(i.status, c), value: i.status };
    // PP-FR-27: after posting, the item the live check couldn't judge is the brand's to decide.
    if (d.review.state === "confirm" && i.status === "asked") status.label = "Needs you";
    return { ...i, status };
  });
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
    case "released": {
      const on = formatDay(r.releasedAt, timeZone);
      // PP-FR-31: each reason from the brand's side.
      const why: Record<typeof r.reason, string> = {
        deadline: `${c} didn’t post by the deadline, so your ${amount} was released on ${on}.`,
        cancelled: `The deal was cancelled, so your ${amount} was released on ${on}.`,
        day_28: `Nothing was decided by the hold’s 28th day, so your ${amount} came back to you on ${on}.`,
        fix_window_ended: `${c} didn’t fix the live post in time, so your ${amount} came back to you on ${on}.`,
        not_accepted: `You didn’t accept the post within 48 hours, so your ${amount} came back to you on ${on}.`,
        ruled_not_to_pay: `A person at Cleared decided not to pay, so your ${amount} came back to you on ${on}.`,
        hold_not_confirmed: `PayPal couldn’t confirm your hold before the deadline, so your ${amount} came back to you on ${on}.`,
      };
      return { ...base, state: r.state, next: { lead: "The hold came back to you.", detail: why[r.reason] } };
    }
    // PP-FR-25 to PP-FR-31: after Approved.
    case "posting":
      return {
        ...base,
        state: r.state,
        next: { lead: `${c} has the go-ahead to post.`, detail: `They post by ${formatDayTime(r.postBy, timeZone)}. Your money is taken only once the live post checks out.` },
      };
    case "live_check":
      return { ...base, state: r.state, next: { lead: "Checking the live post.", detail: `Your money is taken only once it checks out.` } };
    case "confirm": {
      const ms = Date.parse(r.endsAt) - now.getTime();
      return {
        ...base,
        state: r.state,
        timeLeft: { text: left(ms), lastHour: ms < HOUR },
        actions: { ...NONE, confirmPost: true },
        next: {
          lead: "Confirm the post",
          detail: `We couldn’t check ${r.what} automatically. Look at the live post. If you say nothing by ${formatDayTime(r.endsAt, timeZone)}, ${c} is paid.`,
        },
      };
    }
    case "accept": {
      const ms = Date.parse(r.endsAt) - now.getTime();
      return {
        ...base,
        state: r.state,
        timeLeft: { text: left(ms), lastHour: ms < HOUR },
        actions: { ...NONE, acceptPost: true },
        next: { lead: "Accept the post anyway?", detail: `${r.reason} If you don’t accept it by ${formatDayTime(r.endsAt, timeZone)}, the hold comes back to you.` },
      };
    }
    case "with_cleared":
      return {
        ...base,
        state: r.state,
        next: { lead: "A person at Cleared is deciding", detail: `You objected: “${r.reason}” We decide by ${formatDay(r.ruleBy, timeZone)}. Your money stays held until then.` },
      };
    case "taken":
      return {
        ...base,
        state: r.state,
        next: {
          lead: "Paid",
          detail: `Your ${formatAmount(r.amount)} was taken on ${formatDay(r.at, timeZone)} · PayPal ref ${r.reference}. ${r.creatorPaid ? `${c} was paid.` : `${c}’s payment is on its way.`}`,
        },
      };
    case "capture_refused":
      return {
        ...base,
        state: r.state,
        next: { lead: "Your payment failed at PayPal", detail: `Your payment for this post failed at PayPal. Check your PayPal funding; we try again until ${formatDay(r.retryUntil, timeZone)}.` },
      };
    case "approved_not_paid":
      return { ...base, state: r.state, next: { lead: "Approved, not paid", detail: "PayPal never let Cleared take your payment for this post, so nothing was taken." } };
  }
}
