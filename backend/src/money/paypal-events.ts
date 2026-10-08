/**
 * Reads an event PayPal delivered (MP-FR-35 to MP-FR-37). An event is untrusted input until PayPal has
 * verified it, and even then only the few ids this code looks for are read out of it. Its content is
 * never stored or logged (MP-BR-11).
 */
import { z } from "zod";

const PayPalEventSchema = z.object({
  id: z.string().min(1).max(200),
  event_type: z.string().min(1).max(200),
  resource: z.record(z.string(), z.unknown()).default({}),
});

export type PayPalEvent = z.infer<typeof PayPalEventSchema>;

/** The event in a delivery's body, or undefined if the body is not an event. */
export function readEvent(body: string): PayPalEvent | undefined {
  try {
    const parsed = PayPalEventSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** A non-empty string, or undefined. */
export const text = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/** The order, hold and capture an event's resource says it belongs to. */
export function relatedIds(resource: Record<string, unknown>) {
  const ids = object(object(resource.supplementary_data).related_ids);
  return {
    orderId: text(ids.order_id),
    authorizationId: text(ids.authorization_id),
    captureId: text(ids.capture_id),
  };
}

/** Every PayPal reference a refund, reversal or dispute could be found by (MP-FR-39). */
export function everyReference(resource: Record<string, unknown>): string[] {
  const { orderId, authorizationId, captureId } = relatedIds(resource);
  const disputed = Array.isArray(resource.disputed_transactions) ? resource.disputed_transactions : [];
  return [
    captureId,
    text(resource.id),
    ...disputed.map((transaction) => text(object(transaction).seller_transaction_id)),
    authorizationId,
    orderId,
  ].filter((reference): reference is string => reference !== undefined);
}
