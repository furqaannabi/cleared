"use client";

import type { ApiResult } from "@/lib/api";
import type { DealCancelPost } from "@/lib/cancel/deal-cancel-view";
import type { Deliverable } from "@/lib/deliverable/types";
import { formatAmount } from "@/lib/invite/amount";
import { CancelDeal } from "./cancel-deal";

/**
 * A post line's cancel: "Cancel this post" while it can go, "Cancelled · …"
 * once it has, otherwise nothing (the post's own page says why).
 *
 * @param post - the post, with its API `cancel` and `cancelled`
 * @see docs/specs/cancel-frd.md CN-FR-01, CN-FR-11, CN-FR-12
 */
export function PostCancelSlot<T>({
  post,
  cancelled,
  side,
  brandName,
  creatorName,
  sendOne,
  onUpdated,
}: {
  post: DealCancelPost;
  cancelled?: Deliverable["cancelled"];
  side: "creator" | "brand";
  brandName: string;
  creatorName: string;
  sendOne: (deliverableId: string, note?: string) => Promise<ApiResult<T>>;
  onUpdated: (data: T) => void;
}) {
  if (cancelled) {
    const to = side === "brand" ? "you" : brandName;
    return <p className="text-[13.5px] font-bold text-ink-2">{post.held ? `Cancelled · ${formatAmount(post.amount)} back to ${to}` : "Cancelled · nothing held"}</p>;
  }
  if (!post.cancel?.allowed) return null;
  return <CancelDeal posts={[post]} single side={side} brandName={brandName} creatorName={creatorName} sendOne={sendOne} onUpdated={onUpdated} />;
}
