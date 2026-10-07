import type { z } from "zod";
import type { dealSummarySchema } from "@/lib/api/schemas";

/**
 * Where a deal opens: its checklist while it is at the checklist or invite
 * step (BC-FR-03, BC-FR-17), otherwise the deliverable that needs the creator
 * (DC-FR-37). Null when the API names nothing to open.
 */
export function dealHref(deal: z.infer<typeof dealSummarySchema>): string | null {
  const id = encodeURIComponent(deal.id);
  if (deal.step) return `/deals/${id}/checklist`;
  return deal.openDeliverableId ? `/deals/${id}/deliverables/${encodeURIComponent(deal.openDeliverableId)}` : null;
}
