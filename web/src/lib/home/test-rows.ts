import type { PaymentRow } from "./payment-row";

/** A paid Kora Audio YouTube video for $800.00; override any field. Test data only. */
export const aPayment = (p: Partial<PaymentRow> = {}): PaymentRow => ({
  dealId: "deal_kora",
  deliverableId: "del_kora_video",
  brandName: "Kora Audio",
  platform: "youtube_video",
  amountMinor: 80000,
  feeMinor: 4000,
  receivedMinor: 76000,
  currency: "USD",
  stage: "paid",
  payout: { state: "paid", reference: "5UX0294KQ1", at: "2026-10-09T12:00:00.000Z" },
  holdReference: "7HK21934LM",
  heldAt: "2026-09-20T10:00:00.000Z",
  deadline: "2026-10-08T23:59:00.000Z",
  publishedAt: "2026-10-07T15:00:00.000Z",
  paidAt: "2026-10-09T12:00:00.000Z",
  firstCheckPassed: true,
  ...p,
});
