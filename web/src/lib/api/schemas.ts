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
