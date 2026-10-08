import type { BrandDeal } from "@/lib/brand-deal/types";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import { itemCount } from "@/lib/deliverable/format";

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
          return { ...base, text: "The hold came back to you", action: null };
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
