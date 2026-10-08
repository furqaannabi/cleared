/**
 * Turns PayPal's answers into the port's outcomes (money path spec, "A PayPal port"). Pure: no network.
 * A status this code does not know is "unknown", never guessed, so the caller checks again (MP-BR-06).
 */
import { ApiError } from "@paypal/paypal-server-sdk";
import type { AuthorizeResult, CaptureResult, HoldStatus, PayoutStatus, RenewResult } from "./port";

/** Whole cents as the decimal string PayPal takes: 120000 is "1200.00" (MP-BR-05). */
export function dollars(amountCents: number): string {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("An amount sent to PayPal must be a whole, positive number of cents");
  }
  const cents = String(amountCents).padStart(3, "0");
  return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

/** The parts of a PayPal order this code reads. */
export interface OrderAnswer {
  id?: string;
  status?: string;
  purchaseUnits?: { payments?: { authorizations?: { id?: string; status?: string }[] } }[];
}

/** What became of an order: whether money is held on it (MP-FR-03, MP-FR-06). */
export function orderOutcome(order: OrderAnswer): AuthorizeResult | { outcome: "not_held" } {
  const authorization = order.purchaseUnits?.[0]?.payments?.authorizations?.[0];
  if (!authorization) return { outcome: "not_held" };
  switch (authorization.status) {
    case "CREATED":
    case "CAPTURED":
    case "PARTIALLY_CAPTURED":
      return authorization.id ? { outcome: "held", reference: authorization.id } : { outcome: "unknown" };
    case "PENDING":
      return { outcome: "pending" };
    case "DENIED":
    case "VOIDED":
      return { outcome: "declined" };
    default:
      return { outcome: "unknown" };
  }
}

/** Whether a hold still stands (MP-FR-11). A hold PayPal is still reviewing is not confirmed either way. */
export function holdStatus(authorization: { status?: string }): HoldStatus {
  switch (authorization.status) {
    case "CREATED":
      return "in_place";
    case "CAPTURED":
    case "PARTIALLY_CAPTURED":
      return "captured";
    case "VOIDED":
    case "DENIED":
      return "ended";
    default:
      return "unknown";
  }
}

/** What became of renewing a hold (MP-FR-12). */
export function renewOutcome(authorization: { id?: string; status?: string }): RenewResult {
  if (authorization.status === "DENIED") return { outcome: "refused" };
  if (authorization.status === "CREATED" && authorization.id) {
    return { outcome: "renewed", reference: authorization.id };
  }
  return { outcome: "unknown" };
}

/** What became of a capture (MP-FR-24). A pending capture may or may not take the money, so it is unknown. */
export function captureOutcome(capture: { id?: string; status?: string }): CaptureResult {
  switch (capture.status) {
    case "COMPLETED":
      return capture.id ? { outcome: "completed", reference: capture.id } : { outcome: "unknown" };
    case "DECLINED":
    case "FAILED":
      return { outcome: "refused" };
    default:
      return { outcome: "unknown" };
  }
}

/** The parts of a PayPal payout batch this code reads. Cleared sends one payout per batch. */
export interface PayoutAnswer {
  batch_header?: { batch_status?: string };
  items?: { payout_item_id?: string; transaction_status?: string }[];
}

/** How a payout stands (MP-FR-29). */
export function payoutStatus(batch: PayoutAnswer): PayoutStatus {
  const item = batch.items?.[0];
  if (!item) {
    switch (batch.batch_header?.batch_status) {
      case "PENDING":
      case "PROCESSING":
        return { outcome: "pending" };
      case "DENIED":
        return { outcome: "denied" };
      default:
        return { outcome: "unknown" };
    }
  }
  switch (item.transaction_status) {
    case "SUCCESS":
      return item.payout_item_id ? { outcome: "succeeded", reference: item.payout_item_id } : { outcome: "unknown" };
    case "UNCLAIMED":
      return { outcome: "unclaimed" };
    case "FAILED":
      return { outcome: "failed" };
    case "RETURNED":
    case "REFUNDED":
    case "REVERSED":
      return { outcome: "returned" };
    case "BLOCKED":
      return { outcome: "blocked" };
    case "DENIED":
      return { outcome: "denied" };
    case "PENDING":
    case "ONHOLD":
      return { outcome: "pending" };
    default:
      return { outcome: "unknown" };
  }
}

/**
 * True only when PayPal understood the request and said it will not do it. Anything else (no answer, a
 * server error, a rejected login, a rate limit) is not a refusal, and nothing may be retried as new on it.
 */
export function refusedClearly(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 422;
}

/** What may be logged about a failed call: the status and PayPal's ids and issue names, never a payload (MP-BR-11). */
export function describeFailure(error: unknown): { status?: number; debugId?: string; issues?: string[] } {
  if (!(error instanceof ApiError)) return {};
  const result = (error.result ?? {}) as { debug_id?: unknown; details?: { issue?: unknown }[] };
  return {
    status: error.statusCode,
    debugId: typeof result.debug_id === "string" ? result.debug_id : undefined,
    issues: result.details?.map((detail) => detail.issue).filter((issue): issue is string => typeof issue === "string"),
  };
}
