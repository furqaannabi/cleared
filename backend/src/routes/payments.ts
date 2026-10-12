/** The creator's payment history (account and history spec AH-FR-05 to AH-FR-09). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { PLATFORMS } from "../deals/platforms";
import { ErrorSchema, requireCreator, type AppEnv } from "../http/http";
import type { PaymentHistory } from "../payments/history";
import type { Sessions } from "../sessions/sessions";

/** One post that has had a hold. Amounts are whole minor units (AH-BR-07). The PayPal email is never here (AH-FR-08). */
const PaymentSchema = z
  .object({
    dealId: z.string(),
    deliverableId: z.string(),
    brandName: z.string(),
    platform: z.enum(PLATFORMS),
    amountMinor: z.number().int(),
    // Cleared's fee and what the creator receives: there once the hold is taken, as the money path fixed them (AH-FR-07).
    feeMinor: z.number().int().optional(),
    receivedMinor: z.number().int().optional(),
    currency: z.enum(["USD"]),
    stage: z.enum(["held", "captured", "paid", "released", "approved_not_paid"]),
    payout: z
      .object({
        state: z.enum(["sending", "cancelling", "delayed", "unclaimed", "failed", "paid"]),
        reference: z.string().optional(),
        at: z.string().optional(),
      })
      .optional(),
    holdReference: z.string(),
    heldAt: z.string(),
    deadline: z.string(),
    publishedAt: z.string().optional(),
    paidAt: z.string().optional(),
    // Whether the first draft check that finished passed every item. Absent while none has (AH-FR-09).
    firstCheckPassed: z.boolean().optional(),
  })
  .openapi("Payment");

export function registerPaymentRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; payments: PaymentHistory }) {
  const creator = requireCreator(deps.sessions);

  app.openapi(
    createRoute({
      method: "get",
      path: "/me/payments",
      summary: "The signed-in creator's payment history: every post of theirs that has ever had a hold, newest hold first (AH-FR-05)",
      middleware: [creator] as const,
      responses: {
        200: { description: "One row for each post that has had a hold", content: { "application/json": { schema: z.array(PaymentSchema) } } },
        401: { description: "Nobody is signed in", content: { "application/json": { schema: ErrorSchema } } },
      },
    }),
    async (c) => c.json(await deps.payments.of(c.get("creatorId")), 200),
  );
}
