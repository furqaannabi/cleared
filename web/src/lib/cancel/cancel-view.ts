import type { BrandDeliverable } from "@/lib/brand-review/types";
import { formatMoney } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { formatAmount } from "@/lib/invite/amount";

/** What cancelling needs to know about a post, from either side's API. */
export interface CancelInfo {
  cancel: Deliverable["cancel"];
  brandName: string;
  platform: Deliverable["platform"];
  /** The held amount, formatted from the API's figure. */
  amount: string;
}

/** The creator's post, as CancelInfo. */
export const creatorCancelInfo = (d: Deliverable): CancelInfo => ({ cancel: d.cancel, brandName: d.brandName, platform: d.platform, amount: formatMoney(d.hold.amountMinor, d.hold.currency) });
/** The brand's post, as CancelInfo. */
export const brandCancelInfo = (b: BrandDeliverable): CancelInfo => ({ cancel: b.cancel, brandName: b.brandName, platform: b.platform, amount: formatAmount(b.hold.amount) });

const NOUN: Record<Deliverable["platform"], string> = { youtube_video: "video", youtube_short: "Short", instagram_reel: "Reel" };

/** The turned-over money card's words (design B). */
export interface CancelConfirm {
  heading: string;
  goes: string;
  amount: string;
  say: string;
  final: string;
  noteLabel: string;
  confirm: string;
}

/** What one side sees about cancelling one post. */
export interface CancelView {
  /** The quiet button's label, or null when the post can't be cancelled now. */
  button: string | null;
  /** Why it can't be cancelled, while the post isn't finished. */
  why: string | null;
  confirm: CancelConfirm;
}

/**
 * Cancelling one post, for the creator or the brand: the button only when
 * the API allows it, otherwise the line saying why; and the words of the
 * money card turned over to confirm. Amounts are the API's (CN-BR-05); the
 * page decides nothing (CN-BR-01).
 *
 * @param d - the post, with the API's `cancel` field (creatorCancelInfo, brandCancelInfo)
 * @param who.side - whose page this is
 * @param who.creatorName - the creator, as the brand knows them
 * @see docs/specs/cancel-frd.md CN-FR-01, CN-FR-03 to CN-FR-07; design/cancel/option-b.html
 */
export function cancelView(d: CancelInfo, { side, creatorName }: { side: "creator" | "brand"; creatorName: string }): CancelView {
  const c = d.cancel;
  const brand = side === "brand";
  let why: string | null = null;
  if (c && !c.allowed && c.reason === "go_ahead_running") {
    why = `You can’t cancel now: ${brand ? `${creatorName} has` : "you have"} the go-ahead to post.`;
  } else if (c && !c.allowed && c.reason === "published") {
    why = "You can’t cancel now: this post is published.";
  }
  return {
    button: c?.allowed ? "Cancel this post" : null,
    why,
    confirm: {
      heading: "Cancel this post?",
      goes: brand ? "Would come back to you" : `Would go back to ${d.brandName}`,
      amount: d.amount,
      say: `${brand ? "Your" : "Their"} hold is released and the ${NOUN[d.platform]} closes.`,
      final: "This can’t be undone.",
      noteLabel: `Add a note for ${brand ? creatorName : d.brandName} (optional)`,
      confirm: "Cancel the post",
    },
  };
}
