/**
 * Everything the backend asks of PayPal, as one interface (money path spec, "A PayPal port";
 * docs/decisions/2026-10-08-paypal-client-sdk-behind-port.md). The money module depends on this and on
 * nothing else of PayPal's. The real one calls the sandbox; tests use a fake.
 *
 * Two rules every implementation keeps:
 * - No method throws because of what PayPal answered or failed to answer. An unclear answer is "unknown",
 *   and the caller follows it up before doing anything else (MP-BR-06).
 * - Each call that creates or moves money takes a request id. Sending the same id again returns the first
 *   answer and never does the thing twice.
 *
 * Amounts are whole cents (MP-BR-05). References are PayPal's ids, safe to log (MP-BR-11).
 */
export interface PayPalPort {
  /** Creates an order to hold `amountCents` for one deliverable. The brand approves it at `approveUrl`. */
  createOrder(input: { requestId: string; deliverableId: string; amountCents: number }): Promise<CreateOrderResult>;
  /** Holds the money for an order the brand has approved (MP-FR-03). */
  authorizeOrder(input: { requestId: string; orderId: string }): Promise<AuthorizeResult>;
  /** What became of an order: used to settle a pending attempt (MP-FR-06). not_held: nothing was ever held on it. */
  readOrder(orderId: string): Promise<AuthorizeResult | { outcome: "not_held" }>;

  /** Whether a hold still stands (MP-FR-11). */
  readHold(reference: string): Promise<HoldStatus>;
  /** Renews a hold's guarantee. PayPal allows it only once the current guarantee has ended (MP-FR-12). */
  renewHold(input: { requestId: string; reference: string; amountCents: number }): Promise<RenewResult>;
  /** Takes the held money, in full (MP-FR-24). */
  captureHold(input: { requestId: string; reference: string; amountCents: number }): Promise<CaptureResult>;
  /** Gives the hold back to the brand (MP-FR-32). */
  cancelHold(reference: string): Promise<CancelHoldResult>;

  /**
   * Sends money to the creator's PayPal email. The result arrives later, through readPayout or a webhook.
   * Sent again under the same request id, it returns the first payout's reference and sends nothing.
   */
  sendPayout(input: { requestId: string; email: string; amountCents: number }): Promise<SendPayoutResult>;
  readPayout(payoutReference: string): Promise<PayoutStatus>;
  /**
   * Withdraws a payout the creator has not claimed (MP-FR-30). It then reads as "returned". PayPal allows
   * it only once it has finished processing the payout, some seconds after sending; before that, and for
   * any unclear answer, this is "unknown" and is tried again.
   */
  cancelPayout(payoutReference: string): Promise<{ outcome: "cancelled" | "not_cancellable" | "unknown" }>;

  /** True only if PayPal confirms it sent this event (MP-FR-35). */
  verifyWebhook(input: { headers: Record<string, string>; body: string }): Promise<boolean>;
}

export type CreateOrderResult = { outcome: "created"; orderId: string; approveUrl: string } | { outcome: "unknown" };

export type AuthorizeResult =
  | { outcome: "held"; reference: string }
  | { outcome: "declined" }
  | { outcome: "pending" }
  | { outcome: "unknown" };

/** in_place: reserved and not yet taken. ended: cancelled or expired. */
export type HoldStatus = "in_place" | "captured" | "ended" | "unknown";

/** A renewed hold has a new reference; the old one is no longer used. */
export type RenewResult = { outcome: "renewed"; reference: string } | { outcome: "refused" } | { outcome: "unknown" };

export type CaptureResult = { outcome: "completed"; reference: string } | { outcome: "refused" } | { outcome: "unknown" };

/** failed: PayPal would not end the hold, for example because it was already captured. */
export type CancelHoldResult = "cancelled" | "already_ended" | "failed" | "unknown";

export type SendPayoutResult = { outcome: "accepted"; payoutReference: string } | { outcome: "unknown" };

export type PayoutStatus =
  | { outcome: "succeeded"; reference: string }
  | { outcome: "pending" | "unclaimed" | "failed" | "returned" | "blocked" | "denied" | "unknown" };
