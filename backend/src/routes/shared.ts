/** Shapes more than one group of routes answers with. */
import { z } from "@hono/zod-openapi";

/** What a brand's note is about (deal set-up spec DS-FR-38). */
export const NoteAboutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), itemId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("line"), briefLine: z.number().int().positive() }),
  z.object({ kind: z.enum(["amount", "deadline"]), deliverableId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("deal") }),
]);

/** A note's and a reply's text: plain text, trimmed, 1 to 500 characters (DS-FR-38, DS-FR-39). */
export const NoteTextSchema = z.string().trim().min(1).max(500);

/** A brand's note and the creator's reply, as plain text (DS-BR-04). */
export const NoteSchema = z
  .object({
    id: z.string(),
    about: NoteAboutSchema,
    text: z.string(),
    reply: z.string().optional(),
    version: z.number().int(),
  })
  .openapi("Note");
