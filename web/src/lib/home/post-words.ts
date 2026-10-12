import type { PaymentRow } from "./payment-row";

const POST: Record<PaymentRow["platform"], string> = { youtube_video: "YouTube video", youtube_short: "Short", instagram_reel: "Reel" };

/** A post in a word or two: "YouTube video", "Short", "Reel" (HM-FR-16). */
export const postWord = (platform: PaymentRow["platform"]): string => POST[platform];

/** Where a post opens in the creator app. */
export const postHref = (r: Pick<PaymentRow, "dealId" | "deliverableId">): string =>
  `/deals/${encodeURIComponent(r.dealId)}/deliverables/${encodeURIComponent(r.deliverableId)}`;
