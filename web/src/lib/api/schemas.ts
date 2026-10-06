import { z } from "zod";
import { ITEM_STATUSES } from "@/lib/checklist/item-status";

/*
 * Provisional: the creator draft check FRD's mock shape
 * (docs/specs/creator-draft-check-frd.md, "Mocks and the provisional
 * contract"). Moves to contract/ once the API contract is agreed.
 * See docs/decisions/2026-10-06-schema-validation-zod.md.
 */

const itemStatus = z.enum(ITEM_STATUSES);
const isoTime = z.iso.datetime({ offset: true });

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: itemStatus,
  previousStatus: itemStatus.optional(),
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
  state: z.enum(["no_draft", "checking", "results", "fully_passing", "check_failed", "released"]),
  deadline: isoTime,
  items: z.array(checklistItemSchema),
  // Money is integer minor units, never a float (CLAUDE.md "Money").
  hold: z.object({ amountMinor: z.number().int().nonnegative(), currency: z.string().length(3) }),
  reviewWindowEndsAt: isoTime.optional(),
  checkFailure: checkFailureSchema.optional(),
  releasedAt: isoTime.optional(),
  releaseReason: z.enum(["deadline", "cancelled"]).optional(),
  cancelledBy: z.enum(["creator", "brand"]).optional(),
});
