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
  releasedAt: isoTime.optional(),
  releaseReason: z.enum(["deadline", "cancelled"]).optional(),
  cancelledBy: z.enum(["creator", "brand"]).optional(),
  releaseReference: z.string().min(1).optional(),
});
