import { z } from "zod";
import { ITEM_STATUSES } from "@/lib/checklist/item-status";

/*
 * Provisional: the creator draft check FRD's mock shape
 * (docs/specs/creator-draft-check-frd.md, "Mocks and the provisional
 * contract"). Moves to contract/ once the API contract is agreed.
 * See docs/decisions/2026-10-06-schema-validation-zod.md.
 */

const itemStatus = z.enum(ITEM_STATUSES);
// DC-FR-01: the page states the API reports; objected and approved come from the brand's review (DC-FR-50, DC-FR-51).
const deliverableState = z.enum(["no_draft", "checking", "results", "fully_passing", "objected", "approved", "check_failed", "released"]);

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
  // DC-FR-12: every item cites the brief line it came from, except one the creator added (DC 1.13).
  briefLine: z.object({ number: z.number().int().positive(), text: z.string() }).optional(),
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
  state: deliverableState,
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
  // DC-FR-50, DC-FR-51: the brand's review of the latest draft.
  objectedAt: isoTime.optional(),
  approvedAt: isoTime.optional(),
  approvedBy: z.enum(["brand", "window"]).optional(),
  // DC-FR-52: a fresh link for the brand while it has something to do; only ever from the API, never stored.
  reviewLink: z.object({ url: z.url({ protocol: /^https$/ }), emailedTo: z.email().max(254).optional() }).optional(),
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
  step: z.enum(["checklist", "invite", "waiting_for_brand", "changes_requested", "agreed"]).optional(),
  openDeliverableId: z.string().min(1).optional(),
  // DC-FR-33: the deal's deliverables, for the switcher.
  deliverables: z.array(
    z.object({
      id: z.string().min(1),
      platform: z.enum(["youtube_video", "youtube_short", "instagram_reel"]),
      state: deliverableState,
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

/** CH-FR-17, CH-FR-18: one post's hold, as the API reports it. The page never decides a money state (CH-BR-05). */
const holdSchema = z.object({
  state: z.enum(["not_started", "closed", "declined", "pending", "unknown", "held"]),
  reference: z.string().min(1).max(64).optional(),
  // CH-BR-03: fixed when the hold is approved.
  deadline: z.iso.date().optional(),
});

/** What a brand's note is about (CH-FR-10). */
const noteAboutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), itemId: z.string().min(1) }),
  z.object({ kind: z.literal("line"), briefLine: z.number().int().positive() }),
  z.object({ kind: z.enum(["amount", "deadline"]), deliverableId: z.string().min(1) }),
  z.object({ kind: z.literal("deal") }),
]);

/** CH-FR-10, CH-FR-23: a brand's note and the creator's reply; untrusted plain text (CH-BR-07). */
export const noteSchema = z.object({
  id: z.string().min(1),
  about: noteAboutSchema,
  text: z.string().min(1).max(500),
  reply: z.string().min(1).max(500).optional(),
  version: z.number().int().positive(),
});

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
  step: z.enum(["checklist", "invite", "waiting_for_brand", "changes_requested", "agreed"]),
  deliverables: z.array(z.object({ id: z.string().min(1), platform })).min(1).max(10),
  brief: z.object({ lines: z.array(z.object({ number: z.number().int().positive(), text: z.string().max(2000) })) }).optional(),
  reading: z.enum(["idle", "reading", "done", "failed"]),
  readUpTo: z.number().int().nonnegative().optional(),
  items: z.array(draftItemSchema),
  questions: z.array(questionSchema),
  ready: z.boolean(),
  // CH-FR-22: the brand's notes, once it has asked for changes.
  notes: z.array(noteSchema).optional(),
});


/** IN-BR-02: a US-dollar amount as a two-place decimal string, never a number. */
const amount = z.string().regex(/^\d{1,7}\.\d{2}$/);

/** IN-FR-04 to IN-FR-20: a deal at the invite step (provisional; creator invite FRD). */
export const dealInviteSchema = z.object({
  dealId: z.string().min(1),
  brandName: z.string().min(1).max(120),
  step: z.enum(["invite", "waiting_for_brand", "changes_requested", "agreed"]),
  posts: z
    .array(
      z.object({
        deliverableId: z.string().min(1),
        platform,
        // How many checklist items the post has (IN-FR-03).
        itemCount: z.number().int().nonnegative(),
        amount: amount.optional(),
        // IN-BR-01: days after the hold, 1 to 21.
        deadlineDays: z.number().int().min(1).max(21).optional(),
        // IN-FR-06: the API's reason it turned the amount down; plain text.
        amountProblem: z.string().min(1).max(200).optional(),
        // CH-FR-25: the post's hold, once the brand has agreed.
        hold: holdSchema.optional(),
      }),
    )
    .min(1)
    .max(10),
  brandEmail: z.email().max(254).optional(),
  // CH-FR-13, CH-FR-22: the terms version the brand has, and its notes.
  version: z.number().int().positive().optional(),
  notes: z.array(noteSchema).optional(),
  // IN-BR-04: only ever from the API, never stored by the frontend.
  link: z
    .object({
      url: z.url({ protocol: /^https$/ }),
      expiresAt: isoTime,
      emailedTo: z.email().max(254).optional(),
      expired: z.boolean(),
    })
    .optional(),
});

/** IN-FR-10, IN-FR-12: the creator's own details. Only the creator ever sees the PayPal email (IN-BR-05). */
export const creatorProfileSchema = z.object({
  name: z.string().min(1).max(120),
  paypalEmail: z.email().max(254).optional(),
  // Connected accounts only.
  accounts: z.array(z.object({ platform: z.enum(["youtube", "instagram"]), name: z.string().min(1).max(120) })),
});

/**
 * CH-FR-04 to CH-FR-20: the deal as the brand sees it (provisional; confirm
 * and hold FRD). Never carries the creator's PayPal email (CH-BR-08).
 */
export const brandDealSchema = z.object({
  dealId: z.string().min(1),
  creatorName: z.string().min(1).max(120),
  brandName: z.string().min(1).max(120),
  step: z.enum(["waiting_for_brand", "changes_requested", "agreed"]),
  version: z.number().int().positive(),
  agreedAt: isoTime.optional(),
  posts: z
    .array(
      z.object({
        deliverableId: z.string().min(1),
        platform,
        amount,
        deadlineDays: z.number().int().min(1).max(21),
        changed: z.array(z.enum(["amount", "deadline"])).optional(),
        hold: holdSchema,
        // RW-FR-01: where the post's draft stands, once its draft check exists.
        review: z
          .discriminatedUnion("state", [
            z.object({ state: z.literal("nothing_yet") }),
            z.object({ state: z.literal("asked"), count: z.number().int().nonnegative() }),
            z.object({ state: z.literal("window"), endsAt: isoTime }),
            z.object({ state: z.literal("objected"), count: z.number().int().positive() }),
            z.object({ state: z.literal("approved") }),
            z.object({ state: z.literal("released") }),
          ])
          .optional(),
      }),
    )
    .min(1)
    .max(10),
  items: z.array(
    z.object({
      id: z.string().min(1),
      deliverableId: z.string().min(1),
      name: z.string().min(1).max(200),
      briefLine: z.number().int().positive().optional(),
      addedByCreator: z.boolean(),
      changed: z.boolean().optional(),
    }),
  ),
  // The brief is untrusted plain text (BC-BR-03).
  brief: z.array(z.object({ number: z.number().int().positive(), text: z.string().max(2000) })),
  answers: z.array(
    z.object({ briefLine: z.number().int().positive(), kind: z.enum(["suggestion", "own_words", "left_out"]), text: z.string().max(200).optional() }),
  ),
  notes: z.array(noteSchema),
});

/** CH-FR-01: what swapping a link's token returns. The session itself is an HttpOnly cookie the page never sees. */
// RW-FR-03: a review link also says which post to land on.
export const brandSessionSchema = z.object({ dealId: z.string().min(1), deliverableId: z.string().min(1).optional() });

/** RW-FR-07, RW-FR-08: an item's status as the brand reads it. */
export const BRAND_ITEM_STATUSES = ["passed", "fix_needed", "unsure", "at_live_check", "asked", "accepted", "fix_requested", "objected"] as const;

/**
 * RW-FR-05 to RW-FR-24: one post's review as the brand sees it (provisional;
 * brand review FRD). Only the latest draft's facts: never a fix hint, an
 * earlier run or the run number (RW-BR-06), nor the creator's PayPal email.
 */
export const brandDeliverableSchema = z.object({
  dealId: z.string().min(1),
  deliverableId: z.string().min(1),
  creatorName: z.string().min(1).max(120),
  brandName: z.string().min(1).max(120),
  platform,
  // DC-FR-44: the shared deadline date is the creator's.
  creatorTimeZone: z.string().refine(isTimeZone, "Unknown timezone"),
  hold: z.object({ amount, reference: z.string().min(1).max(64), deadline: isoTime }),
  review: z.discriminatedUnion("state", [
    z.object({ state: z.literal("nothing_yet") }),
    z.object({ state: z.literal("asked") }),
    z.object({ state: z.literal("window"), endsAt: isoTime }),
    z.object({ state: z.literal("objected"), objectedAt: isoTime }),
    z.object({ state: z.literal("approved"), approvedAt: isoTime, by: z.enum(["brand", "window"]) }),
    z.object({ state: z.literal("released"), releasedAt: isoTime, reason: z.enum(["deadline", "cancelled"]) }),
  ]),
  draft: z
    .object({
      url: videoUrl,
      urlExpiresAt: isoTime,
      durationSec: z.number().positive(),
      items: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string(),
          kind: itemKind,
          checkedBy: checklistItemSchema.shape.checkedBy,
          status: z.enum(BRAND_ITEM_STATUSES),
          // Absent when the creator added the item (DC 1.13).
          briefLine: z.object({ number: z.number().int().positive(), text: z.string() }).optional(),
          evidence: checklistItemSchema.shape.evidence,
          // The brand's own note, on an item it asked to be fixed or objected to; plain text (RW-BR-09).
          note: z.string().max(500).optional(),
        }),
      ),
    })
    .optional(),
});

/** CH-FR-17: a started hold: the PayPal order the approval step needs (provisional). */
export const holdStartSchema = z.object({ orderId: z.string().min(1).max(64) });
