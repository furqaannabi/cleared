import { z } from "zod";

/**
 * One post that has ever had a hold, as the requested `GET /me/payments`
 * answers it (creator home FRD, "Requests for Furqaan"). Amounts are integer
 * cents; the fee and what the creator receives are the API's figures.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-05 to HM-FR-19
 */
export const paymentRowSchema = z.object({
  dealId: z.string().min(1),
  deliverableId: z.string().min(1),
  brandName: z.string().min(1).max(120),
  platform: z.enum(["youtube_video", "youtube_short", "instagram_reel"]),
  amountMinor: z.number().int().nonnegative(),
  feeMinor: z.number().int().nonnegative(),
  receivedMinor: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  stage: z.enum(["held", "captured", "paid", "released", "closed"]),
  payout: z
    .object({
      state: z.enum(["sending", "cancelling", "delayed", "unclaimed", "failed", "paid"]),
      reference: z.string().min(1).max(64).optional(),
      at: z.string().datetime().optional(),
    })
    .optional(),
  holdReference: z.string().min(1).max(64),
  heldAt: z.string().datetime(),
  deadline: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  firstCheckPassed: z.boolean().nullable(),
});

export const paymentsSchema = z.array(paymentRowSchema);
export type PaymentRow = z.infer<typeof paymentRowSchema>;
