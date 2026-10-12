import type { components } from "contract";
import { z } from "zod";
import type { SameShape } from "@/lib/api/same-shape";

/**
 * One post that has ever had a hold, as the contract's `GET /me/payments`
 * answers it (AH-FR-05). Amounts are integer cents; the fee and what the
 * creator receives are the API's figures, sent only once the hold is taken.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-05 to HM-FR-19 (1.4)
 */
export const paymentRowSchema = z.object({
  dealId: z.string().min(1),
  deliverableId: z.string().min(1),
  brandName: z.string().min(1).max(120),
  platform: z.enum(["youtube_video", "youtube_short", "instagram_reel"]),
  amountMinor: z.number().int().nonnegative(),
  // HM-FR-05 (1.4): absent until the hold is taken.
  feeMinor: z.number().int().nonnegative().optional(),
  receivedMinor: z.number().int().nonnegative().optional(),
  currency: z.literal("USD"),
  stage: z.enum(["held", "captured", "paid", "released", "approved_not_paid"]),
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
  // Absent until a draft check has finished.
  firstCheckPassed: z.boolean().optional(),
});
// HM 1.4: a payment row is the contract's `Payment`, checked both ways at compile time.
const paymentIsTheContracts: SameShape<z.infer<typeof paymentRowSchema>, components["schemas"]["Payment"]> = true;
void paymentIsTheContracts;

export const paymentsSchema = z.array(paymentRowSchema);
export type PaymentRow = z.infer<typeof paymentRowSchema>;
