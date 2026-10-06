import type { z } from "zod";
import type { checkFailureSchema, checklistItemSchema, deliverableSchema } from "@/lib/api/schemas";

/*
 * Types for API data, derived from the provisional Zod schemas so there is
 * one source (docs/decisions/2026-10-06-schema-validation-zod.md).
 */

export type Deliverable = z.infer<typeof deliverableSchema>;
/** DC-FR-01: the six page states, reported by the API. */
export type DeliverableState = Deliverable["state"];
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
/** DC-FR-08, DC-FR-09: why a check could not run. */
export type CheckFailure = z.infer<typeof checkFailureSchema>;
/** DC-FR-27: the PayPal hold. Amounts are integer minor units. */
export type Hold = Deliverable["hold"];
