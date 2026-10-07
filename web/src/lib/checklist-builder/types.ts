import type { z } from "zod";
import type { dealDraftSchema, draftItemSchema, questionSchema } from "@/lib/api/schemas";

/* Types for the brief → checklist step, derived from the provisional schemas (BC FRD). */
export type DealDraft = z.infer<typeof dealDraftSchema>;
export type DraftItem = z.infer<typeof draftItemSchema>;
export type Question = z.infer<typeof questionSchema>;
export type ItemKind = DraftItem["kind"];
