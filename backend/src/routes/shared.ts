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

/**
 * A post's hold, as the money path has it (DS-FR-44). `deadline` is the date the creator must post by,
 * fixed when the hold is approved and read in the creator's timezone.
 */
export const HoldSchema = z
  .object({
    state: z.enum(["not_started", "closed", "declined", "pending", "unknown", "held"]),
    reference: z.string().optional(),
    deadline: z.string().optional(),
  })
  .openapi("Hold");

/**
 * Where on Cleared's own app to send the browser afterwards (DS-FR-04). Anything that is not a path on
 * the app is ignored.
 */
export const NextSchema = z.object({ next: z.string().optional() });

/** Whether a post can be cancelled now, or why not, and whether a hold attempt is waiting at PayPal (PT-FR-31). */
export const CancelSchema = z
  .union([
    z.object({ allowed: z.literal(true), holdAttemptWaiting: z.literal(true).optional() }),
    z.object({ allowed: z.literal(false), reason: z.enum(["go_ahead_running", "published", "finished"]) }),
  ])
  .openapi("Cancel");

/** Who cancelled a post, when, and their note, which is plain text (PT-FR-32, PT-BR-10). */
export const CancelledSchema = z.object({ by: z.enum(["creator", "brand"]), at: z.string(), note: z.string().optional() }).openapi("Cancelled");

/** A cancel's optional note: plain text, up to 300 characters after trimming. */
export const CancelBodySchema = z.object({ note: z.string().trim().max(300).optional() });

/**
 * Where a post stands for the brand once its draft is approved (publish to paid spec PT-FR-23). It
 * never holds the creator's PayPal email or anything about a payout but whether it arrived (PT-BR-09).
 */
export const BrandLaterStates = [
  z.object({ state: z.literal("posting"), postBy: z.string() }),
  z.object({ state: z.enum(["live_check", "taking", "approved_not_paid"]) }),
  z.object({ state: z.literal("confirm"), endsAt: z.string(), what: z.array(z.enum(["file_record", "paid_promotion", "written_item"])) }),
  z.object({ state: z.literal("accept"), endsAt: z.string(), reason: z.enum(["not_your_channel", "not_the_approved_file"]) }),
  z.object({ state: z.literal("with_cleared"), reason: z.string(), ruleBy: z.string() }),
  z.object({ state: z.literal("capture_refused"), retryUntil: z.string() }),
  z.object({ state: z.literal("taken"), amount: z.string(), reference: z.string(), at: z.string(), creatorPaid: z.boolean() }),
] as const;

