import { z } from "zod";
import { ITEM_STATUSES } from "@/lib/checklist/item-status";

/*
 * Provisional: the creator draft check FRD's mock shape
 * (docs/specs/creator-draft-check-frd.md, "Mocks and the provisional
 * contract"). Moves to contract/ once the API contract is agreed.
 * See docs/decisions/2026-10-06-schema-validation-zod.md.
 */

const itemStatus = z.enum(ITEM_STATUSES);

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const isoTime = z.iso.datetime({ offset: true });

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(["said", "shown_as_text", "shown", "timing", "written", "disclosure", "publication"]),
  status: itemStatus,
  previousStatus: itemStatus.optional(),
  // DC-FR-12: every item cites the brief line it came from.
  briefLine: z.object({ number: z.number().int().positive(), text: z.string() }),
  evidence: z
    .object({
      label: z.string(),
      text: z.string(),
      startSec: z.number().nonnegative().optional(),
      endSec: z.number().nonnegative().optional(),
    })
    .optional(),
  checkedBy: z.enum(["exact_match", "ai_timestamp", "from_timestamps", "published_post", "platform_record"]),
  // DC-FR-14 to DC-FR-18: the API decides whether an item can be asked about.
  askable: z.boolean().optional(),
  askedAt: isoTime.optional(),
  declined: z.boolean().optional(),
  // Written by the brand: shown as plain text only (DC-BR-09).
  brandNote: z.string().max(1000).optional(),
  // DC-FR-46: from code or the AI; plain text only, never affects the result.
  fixHint: z.string().max(280).optional(),
});

export const checkFailureSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("file"),
    reason: z.enum(["unreadable", "format", "too_long", "not_same_video"]),
    fileName: z.string(),
    lengthSec: z.number().nonnegative().optional(),
    lengthCapSec: z.number().positive().optional(),
  }),
  z.object({ kind: z.literal("ours"), retrying: z.boolean(), fileName: z.string() }),
]);

// DC-FR-23: a short-lived link to the draft file. Only https (a presigned link) or a
// same-origin path (mocks) may become a video source.
const videoUrl = z.string().refine((u) => u.startsWith("https://") || (u.startsWith("/") && !u.startsWith("//")), "Unsafe video URL");

export const draftSchema = z.object({
  fileName: z.string(),
  durationSec: z.number().positive(),
  url: videoUrl,
  urlExpiresAt: isoTime,
});

export const deliverableSchema = z.object({
  id: z.string().min(1),
  brandName: z.string().min(1),
  // DC-FR-25, DC-FR-32: sets the title and the player's aspect ratio.
  platform: z.enum(["youtube_video", "youtube_short", "instagram_reel"]),
  state: z.enum(["no_draft", "checking", "results", "fully_passing", "check_failed", "released"]),
  deadline: isoTime,
  // DC-FR-44: the deadline is 23:59 on its day here; must be a timezone the browser knows.
  creatorTimeZone: z.string().refine(isTimeZone, "Unknown timezone"),
  items: z.array(checklistItemSchema),
  // DC-FR-32: the latest draft check run (0 before any draft).
  run: z.number().int().nonnegative().optional(),
  // DC-FR-30: the deal's brief as numbered lines, for View brief. Written by the brand: plain text only.
  brief: z.array(z.object({ number: z.number().int().positive(), text: z.string().max(2000) })).optional(),
  // DC-FR-23: the latest draft, once one has been uploaded.
  draft: draftSchema.optional(),
  // Money is integer minor units, never a float (CLAUDE.md "Money").
  hold: z.object({
    amountMinor: z.number().int().nonnegative(),
    currency: z.string().length(3),
    // DC-FR-27: the PayPal reference, when it was held, and the money stage (from the API, never derived).
    reference: z.string().min(1),
    heldAt: isoTime,
    stage: z.enum(["held", "confirmed", "captured", "paid"]),
  }),
  payoutEmail: z.email(),
  reviewWindowEndsAt: isoTime.optional(),
  checkFailure: checkFailureSchema.optional(),
  // DC-FR-03, DC-FR-04: when the running check started, and its stages if the backend reports them.
  checkStartedAt: isoTime.optional(),
  stages: z.array(z.object({ name: z.string().max(80), status: z.enum(["done", "current", "waiting"]) })).optional(),
  releasedAt: isoTime.optional(),
  releaseReason: z.enum(["deadline", "cancelled"]).optional(),
  cancelledBy: z.enum(["creator", "brand"]).optional(),
  releaseReference: z.string().min(1).optional(),
});

/** DC-FR-31, DC-FR-37: one deal in the creator's list, and which deliverable to open for it. */
export const dealSummarySchema = z.object({
  id: z.string().min(1),
  brandName: z.string().min(1),
  // One line, e.g. "Brand review · 31h left"; shown as plain text.
  status: z.string().max(120),
  // BC-FR-03: a deal still at the checklist or invite step has no deliverable to open yet.
  step: z.enum(["checklist", "invite"]).optional(),
  openDeliverableId: z.string().min(1).optional(),
  // DC-FR-33: the deal's deliverables, for the switcher.
  deliverables: z.array(
    z.object({
      id: z.string().min(1),
      platform: z.enum(["youtube_video", "youtube_short", "instagram_reel"]),
      state: z.enum(["no_draft", "checking", "results", "fully_passing", "check_failed", "released"]),
    }),
  ),
});

export const dealsSchema = z.array(dealSummarySchema);

const platform = z.enum(["youtube_video", "youtube_short", "instagram_reel"]);
const itemKind = z.enum(["said", "shown_as_text", "shown", "timing", "written", "disclosure", "publication"]);

/** BC-FR-10: one checklist item being built, citing its brief line unless the creator added it (BC-BR-01). */
export const draftItemSchema = z
  .object({
    id: z.string().min(1),
    deliverableId: z.string().min(1),
    name: z.string().min(1).max(200),
    kind: itemKind,
    briefLine: z.number().int().positive().optional(),
    addedByCreator: z.boolean(),
    checkedBy: z.enum(["exact_match", "ai_timestamp", "at_live_check"]),
  })
  .refine((i) => i.addedByCreator || i.briefLine !== undefined, "An item cites a brief line or is added by the creator");

/** BC-FR-13: the AI's question about an ambiguous brief line. */
export const questionSchema = z.object({
  id: z.string().min(1),
  briefLine: z.number().int().positive(),
  text: z.string().min(1).max(300),
  suggestions: z.array(z.string().min(1).max(120)).max(3),
  answer: z
    .object({ kind: z.enum(["suggestion", "own_words", "left_out"]), text: z.string().max(200).optional() })
    .optional(),
});

/** BC-FR-03 to BC-FR-18: a deal at the brief → checklist step (provisional). The brief is untrusted plain text (BC-BR-03). */
export const dealDraftSchema = z.object({
  id: z.string().min(1),
  brandName: z.string().min(1).max(120),
  step: z.enum(["checklist", "invite"]),
  deliverables: z.array(z.object({ id: z.string().min(1), platform })).min(1).max(10),
  brief: z.object({ lines: z.array(z.object({ number: z.number().int().positive(), text: z.string().max(2000) })) }).optional(),
  reading: z.enum(["idle", "reading", "done", "failed"]),
  readUpTo: z.number().int().nonnegative().optional(),
  items: z.array(draftItemSchema),
  questions: z.array(questionSchema),
  ready: z.boolean(),
});

