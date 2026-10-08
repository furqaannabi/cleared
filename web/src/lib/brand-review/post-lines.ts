import type { BrandDeal } from "@/lib/brand-deal/types";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import { itemCount } from "@/lib/deliverable/format";
import { formatAmount } from "@/lib/invite/amount";

/** One post's draft, as a line on the brand's deal page. */
export interface PostLine {
  deliverableId: string;
  label: string;
  platform: BrandDeal["posts"][number]["platform"];
  text: string;
  /** The brand has something to do here: an ask, or the window. */
  needsYou: boolean;
  action: { text: string; href: string; style: "primary" | "outline" | "link" } | null;
}

/** "23 Oct": a hold's fixed deadline date (no time of day). */
function day(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "31h 12m", or "42m" under an hour. */
function left(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/**
 * Each held post's draft for the brand's deal page, the posts that need the
 * brand first (the window ending soonest at the top), then the rest in deal
 * order. A post without a draft check yet has no line.
 *
 * @param deal - the deal as the brand sees it
 * @param now - the current time, for the time left
 * @see docs/specs/brand-review-frd.md RW-FR-01, RW-FR-02
 */
export function postLines(deal: Pick<BrandDeal, "dealId" | "creatorName" | "posts">, now: Date): PostLine[] {
  const c = deal.creatorName;
  const lines = deal.posts.flatMap((p) => {
    const r = p.review;
    if (!r) return [];
    const href = `/brand/deals/${encodeURIComponent(deal.dealId)}/deliverables/${encodeURIComponent(p.deliverableId)}`;
    const postBy = p.hold.deadline ? ` · ${c} posts by ${day(p.hold.deadline)}` : "";
    const base = { deliverableId: p.deliverableId, label: PLATFORM_LABEL[p.platform], platform: p.platform, needsYou: false, action: null };
    const line: PostLine & { endsAt?: number } = (() => {
      switch (r.state) {
        case "window":
          return { ...base, needsYou: true, endsAt: Date.parse(r.endsAt), text: `Draft ready for your review · ${left(Date.parse(r.endsAt) - now.getTime())} left`, action: { text: "Review draft", href, style: "primary" as const } };
        case "asked":
          return r.count
            ? { ...base, needsYou: true, text: `${c} asked you about ${itemCount(r.count)}`, action: { text: "Review draft", href, style: "outline" as const } }
            : { ...base, text: `${c} is working on the draft${postBy}`, action: { text: "View draft", href, style: "link" as const } };
        case "objected":
          return { ...base, text: `You asked ${c} to fix ${itemCount(r.count)} · Waiting for a new draft`, action: { text: "View draft", href, style: "link" as const } };
        case "approved":
          return { ...base, text: `Approved${postBy}`, action: null };
        case "released":
          // CN-FR-12: a cancelled post says so, and who cancelled it.
          if (p.cancelled) return { ...base, text: `Cancelled by ${p.cancelled.by === "brand" ? "you" : c}`, action: null };
          return { ...base, text: "The hold came back to you", action: null };
        // PP-FR-25: after Approved; the brand's two decisions come first, the soonest at the top.
        case "confirm":
        case "accept":
          return {
            ...base,
            needsYou: true,
            endsAt: Date.parse(r.endsAt),
            text: `${r.state === "confirm" ? "Confirm the post" : "Accept the post?"} · ${left(Date.parse(r.endsAt) - now.getTime())} left`,
            action: { text: "Review post", href, style: "primary" as const },
          };
        case "posting":
          return { ...base, text: `${c} has the go-ahead · posts by ${day(r.postBy.slice(0, 10))}`, action: { text: "View draft", href, style: "link" as const } };
        case "live_check":
          return { ...base, text: "Posted · checking the live post", action: { text: "View post", href, style: "link" as const } };
        case "with_cleared":
          return { ...base, text: "A person at Cleared is deciding", action: { text: "View post", href, style: "link" as const } };
        case "taken":
          return { ...base, text: `Paid · ${formatAmount(r.amount)} taken`, action: { text: "View post", href, style: "link" as const } };
        case "approved_not_paid":
          return { ...base, text: "Approved, not paid", action: null };
        default:
          return { ...base, text: `${c} is working on the draft${postBy}` };
      }
    })();
    return [line];
  });
  const rank = (l: PostLine & { endsAt?: number }) => (l.endsAt !== undefined ? 0 : l.needsYou ? 1 : 2);
  return lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l) - rank(b.l) || (a.l.endsAt ?? 0) - (b.l.endsAt ?? 0) || a.i - b.i)
    .map(({ l }) => {
      const { endsAt, ...line } = l;
      void endsAt;
      return line;
    });
}
