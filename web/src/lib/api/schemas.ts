import type { components } from "contract";
import type { SameShape } from "./same-shape";
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
const deliverableState = z.enum([
  "no_draft", "checking", "results", "fully_passing", "objected", "approved", "check_failed", "released",
  // PP-FR-01 to PP-FR-23: past Approved.
  "posting", "published", "captured", "paid", "approved_not_paid",
]);
const money = z.string().regex(/^\d{1,7}\.\d{2}$/);
/** PP-BR-05: a post link is only ever https on the platform's own domain. */
const postUrl = z.url({ protocol: /^https$/, hostname: /^(www\.)?(youtube\.com|youtu\.be|instagram\.com)$/ });
// PP-FR-14, PP-FR-28 (1.3): what the live check couldn't decide, and why a live post can't be fixed, as codes.
// PP 1.5: a Reel's, from IG 1.2.
const undecided = z.enum(["file_record", "paid_promotion", "written_item", "paid_partnership_label", "reel_not_fetched", "reel_match"]);
const notFixableReason = z.enum(["not_your_channel", "not_the_approved_file"]);
const releaseReason = z.enum(["deadline", "cancelled", "day_28", "fix_window_ended", "not_accepted", "ruled_not_to_pay", "hold_not_confirmed"]);

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const isoTime = z.iso.datetime({ offset: true });
/** IN-BR-04 (1.3): a link on the app's own address: https, or http only on localhost for local work. */
const appLinkUrl = z.url({ protocol: /^https?$/ }).refine((u) => u.startsWith("https://") || new URL(u).hostname === "localhost", "Links are https");

/** CN-FR-03: whether a post can be cancelled now, and if not, why (MP-FR-33). */
const cancelSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true), holdAttemptWaiting: z.literal(true).optional() }),
  z.object({ allowed: z.literal(false), reason: z.enum(["go_ahead_running", "published", "finished"]) }),
]);
/** CN-FR-10, CN-FR-11: who cancelled a post, when, and their note (plain text, CN-BR-04). */
const cancelledSchema = z.object({ by: z.enum(["creator", "brand"]), at: isoTime, note: z.string().max(300).optional() });

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
    // DC-FR-08 (1.18): never "not the same video"; the unlisted video is asked for at publishing.
    reason: z.enum(["unreadable", "format", "too_long"]),
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
  run: z.number().int().nonnegative(),
  // DC-FR-30: the deal's brief as numbered lines, for View brief. Written by the brand: plain text only.
  brief: z.array(z.object({ number: z.number().int().positive(), text: z.string().max(2000) })),
  // DC-FR-23: the latest draft, once one has been uploaded.
  draft: draftSchema.optional(),
  // Money is integer minor units, never a float (CLAUDE.md "Money").
  hold: z.object({
    amountMinor: z.number().int().nonnegative(),
    currency: z.literal("USD"),
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
  // PP-FR-01 to PP-FR-05: the go-ahead to post, as the API answers it.
  goAhead: z
    .discriminatedUnion("state", [
      z.object({ state: z.literal("go"), endsAt: isoTime }),
      z.object({ state: z.literal("wait"), until: isoTime }),
      // PP-FR-01 (1.3): PayPal is being asked; the page asks again until it answers.
      z.object({ state: z.literal("confirming") }),
      z.object({ state: z.literal("not_confirmed") }),
      z.object({ state: z.literal("ended") }),
    ])
    .optional(),
  // PP-FR-06 to PP-FR-09: the published post.
  post: z.object({ url: postUrl, publishedAt: isoTime }).optional(),
  // PP-FR-09 to PP-FR-15: the live check's overall result; plain text throughout (PP-BR-03).
  liveCheck: z
    .discriminatedUnion("state", [
      z.object({ state: z.literal("checking") }),
      z.object({ state: z.literal("passed") }),
      // PP-FR-38 (1.3): the check can't run yet.
      z.object({ state: z.literal("reconnect_youtube") }),
      z.object({ state: z.literal("video_not_found") }),
      // PP-FR-38 (1.5): a Reel's (IG-FR-27).
      z.object({ state: z.literal("reconnect_instagram") }),
      z.object({ state: z.literal("reel_not_found") }),
      // PP-FR-39 (1.3): approved by someone other than the live check.
      z.object({ state: z.literal("approved"), by: z.enum(["brand_confirmed", "brand_silence", "brand_accepted", "cleared"]) }),
      // PP-FR-12 (1.3): `checking` while a check again runs.
      z.object({ state: z.literal("fixable"), fixBy: isoTime, checking: z.literal(true).optional() }),
      z.object({ state: z.literal("not_fixable"), reason: notFixableReason, brandBy: isoTime }),
      z.object({ state: z.literal("undecided"), what: z.array(undecided), brandBy: isoTime }),
      z.object({ state: z.literal("objected"), reason: z.string().max(500), ruleBy: isoTime }),
    ])
    .optional(),
  // PP-FR-17, PP-FR-21: the capture, with the fee and payout as the API works them out (PP-BR-07); or refused, retried until a date.
  capture: z
    .union([
      z.object({ reference: z.string().min(1).max(64), at: isoTime, amount: money, fee: money, payout: money }),
      z.object({ refused: z.literal(true), retryUntil: isoTime }),
    ])
    .optional(),
  // PP-FR-17 to PP-FR-20, PP-FR-35, PP-FR-36: the payout to the creator; only ever shown to the creator (PP-BR-04).
  // "delayed" is a payout PayPal won't send (MP-FR-45); "cancelling" an unclaimed one being cancelled before it's sent again (MP-FR-30).
  payout: z
    .object({
      state: z.enum(["sending", "cancelling", "delayed", "unclaimed", "failed", "paid"]),
      email: z.email(),
      // PP-FR-20 (1.3): why PayPal couldn't pay, as a code.
      reason: z.enum(["failed", "returned", "blocked", "denied"]).optional(),
      reference: z.string().min(1).max(64).optional(),
      at: isoTime.optional(),
      canSendAgain: z.boolean(),
    })
    .optional(),
  // DC-FR-52: a fresh link for the brand while it has something to do; only ever from the API, never stored.
  // DC-FR-52 (1.18): never emailed; when it expires, and when the brand first opened the draft.
  reviewLink: z.object({ url: appLinkUrl, expiresAt: isoTime, expired: z.boolean() }).optional(),
  reviewOpenedAt: isoTime.optional(),
  checkFailure: checkFailureSchema.optional(),
  // DC-FR-03, DC-FR-04: when the running check started, and its stages if the backend reports them.
  checkStartedAt: isoTime.optional(),
  stages: z.array(z.object({ name: z.string().max(80), status: z.enum(["done", "current", "waiting"]) })).optional(),
  releasedAt: isoTime.optional(),
  releaseReason: releaseReason.optional(),
  // CN-FR-03: whether this post can be cancelled now, and if not, why (MP-FR-33).
  cancel: cancelSchema.optional(),
  // CN-FR-10, CN-FR-11: who cancelled, when, and their note (plain text, CN-BR-04).
  cancelled: cancelledSchema.optional(),
  // PP-FR-22 (1.3): shown only when sent; not in the contract yet (asked of Furqaan).
  releaseReference: z.string().min(1).optional(),
});
// PP 1.3: the creator's post is the contract's `CreatorPost`, checked both ways at compile time, but for the release reference it doesn't send yet.
const creatorPostIsTheContracts: SameShape<Omit<z.infer<typeof deliverableSchema>, "releaseReference">, components["schemas"]["CreatorPost"]> = true;
void creatorPostIsTheContracts;

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
      // AH-FR-03: a post closed without a hold, with why.
      state: z.enum([...deliverableState.options, "closed"]),
      closedBecause: z.enum(["never_held", "cancelled"]).optional(),
      // AH-FR-04, HM-FR-15 (1.3): whether its next step is the creator's.
      needsCreator: z.boolean(),
    }),
  ),
});
// HM 1.3: the deals list is the contract's `DealSummary`, checked both ways at compile time.
const dealSummaryIsTheContracts: SameShape<z.infer<typeof dealSummarySchema>, components["schemas"]["DealSummary"]> = true;
void dealSummaryIsTheContracts;

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
  state: z.enum(["not_started", "closed", "declined", "pending", "unknown", "held", "not_held"]),
  // CH-FR-18 (1.7), AH-FR-02: why a try was declined.
  reason: z.enum(["paypal_declined", "timed_out"]).optional(),
  // CH-FR-18 (1.7), AH-FR-01: why a post was closed without a hold.
  because: z.enum(["never_held", "cancelled"]).optional(),
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
// BC 1.4: the deal draft is the contract's `DealDraft`, checked both ways at compile time.
const dealDraftIsTheContracts: SameShape<z.infer<typeof dealDraftSchema>, components["schemas"]["DealDraft"]> = true;
void dealDraftIsTheContracts;

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
        // CH-FR-25: the post's hold, once the brand has agreed.
        hold: holdSchema.optional(),
        // CN-FR-03, CN-FR-10, CN-FR-11
        cancel: cancelSchema.optional(),
        cancelled: cancelledSchema.optional(),
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
      url: appLinkUrl,
      expiresAt: isoTime,
      expired: z.boolean(),
    })
    .optional(),
});
// IN 1.3: the invite is the contract's `Invite`, checked both ways at compile time.
const inviteIsTheContracts: SameShape<z.infer<typeof dealInviteSchema>, components["schemas"]["Invite"]> = true;
void inviteIsTheContracts;

/** IN-FR-10, IN-FR-12: the creator's own details. Only the creator ever sees the PayPal email (IN-BR-05). */
export const creatorProfileSchema = z.object({
  name: z.string().min(1).max(120),
  // SI-FR-04 (1.1): the signed-in email and whether the welcome was seen. No demo flag.
  email: z.email().max(254).optional(),
  welcomed: z.boolean(),
  paypalEmail: z.email().max(254).optional(),
  // Connected accounts only.
  // ST 1.3 (AH-FR-10): `inUse` is whether a held post on that platform keeps it from being disconnected; read, not shown yet.
  accounts: z.array(z.object({ platform: z.enum(["youtube", "instagram"]), name: z.string().min(1).max(120), inUse: z.boolean() })),
});
/** IN-FR-12 (1.3): the profile after a new PayPal email, with the payouts already with PayPal that keep the old one. */
export const profileAfterEmailSchema = creatorProfileSchema.extend({
  postsKeepingEmail: z.array(z.object({ deliverableId: z.string().min(1), dealId: z.string().min(1), brandName: z.string().min(1).max(120), email: z.string().max(254) })),
});
const profileAfterEmailIsTheContracts: SameShape<z.infer<typeof profileAfterEmailSchema>, components["schemas"]["ProfileAfterEmail"]> = true;
void profileAfterEmailIsTheContracts;

// The move onto the live API (1.1): the profile is the contract's `Profile`, checked both ways at compile time.
const profileIsTheContracts: SameShape<z.infer<typeof creatorProfileSchema>, components["schemas"]["Profile"]> = true;
void profileIsTheContracts;

/** PP-FR-25 to PP-FR-31, PP-FR-41: the brand's later states, the same on the deal page and the post (PP 1.3, the contract's). */
const brandLaterReview = [
  z.object({ state: z.literal("posting"), postBy: isoTime }),
  z.object({ state: z.literal("live_check") }),
  z.object({ state: z.literal("taking") }),
  z.object({ state: z.literal("approved_not_paid") }),
  z.object({ state: z.literal("confirm"), endsAt: isoTime, what: z.array(undecided) }),
  z.object({ state: z.literal("accept"), endsAt: isoTime, reason: notFixableReason }),
  z.object({ state: z.literal("with_cleared"), reason: z.string().max(500), ruleBy: isoTime }),
  z.object({ state: z.literal("capture_refused"), retryUntil: isoTime }),
  z.object({ state: z.literal("taken"), amount: money, reference: z.string().min(1).max(64), at: isoTime, creatorPaid: z.boolean() }),
] as const;

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
  // CH-FR-17 (1.3): PayPal's sandbox client id for the approval button; public, never a secret.
  paypalClientId: z.string().min(1).max(200).optional(),
  posts: z
    .array(
      z.object({
        deliverableId: z.string().min(1),
        platform,
        amount,
        deadlineDays: z.number().int().min(1).max(21),
        changed: z.array(z.enum(["amount", "deadline"])).optional(),
        hold: holdSchema,
        // CN-FR-03, CN-FR-10, CN-FR-11
        cancel: cancelSchema.optional(),
        cancelled: cancelledSchema.optional(),
        // RW-FR-01: where the post's draft stands, once its draft check exists.
        review: z
          .discriminatedUnion("state", [
            z.object({ state: z.literal("nothing_yet") }),
            z.object({ state: z.literal("asked"), count: z.number().int().nonnegative() }),
            z.object({ state: z.literal("window"), endsAt: isoTime }),
            z.object({ state: z.literal("objected"), count: z.number().int().nonnegative() }),
            z.object({ state: z.literal("approved") }),
            z.object({ state: z.literal("released") }),
            // PP-FR-25: past Approved; 1.3: the contract's shapes, with taking and a refused capture.
            ...brandLaterReview,
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
    z.object({ state: z.literal("released"), releasedAt: isoTime, reason: releaseReason }),
    // PP-FR-25 to PP-FR-31, PP-FR-41: past Approved.
    ...brandLaterReview,
  ]),
  // PP-FR-26: the live post, once there is one, with the live results of its items (1.3).
  post: z
    .object({
      url: postUrl,
      items: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string(),
          kind: itemKind,
          checkedBy: checklistItemSchema.shape.checkedBy,
          status: z.enum(["passed", "fix_needed", "unsure"]),
          briefLine: z.object({ number: z.number().int().positive(), text: z.string() }).optional(),
          // Evidence from the live post; plain text (PP-BR-03).
          evidence: z.object({ label: z.string(), text: z.string() }).optional(),
        }),
      ),
    })
    .optional(),
  // CN-FR-03, CN-FR-10: as on the creator's side.
  cancel: cancelSchema.optional(),
  cancelled: cancelledSchema.optional(),
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
          // PP 1.3: the contract always sends the evidence's times.
          evidence: z.object({ label: z.string(), text: z.string(), startSec: z.number().nonnegative(), endSec: z.number().nonnegative() }).optional(),
          // The brand's own note, on an item it asked to be fixed or objected to; plain text (RW-BR-09).
          note: z.string().max(500).optional(),
        }),
      ),
    })
    .optional(),
});

/** CH-FR-17: a started hold: the PayPal order the approval step needs (provisional). */
export const holdStartSchema = z.object({ orderId: z.string().min(1).max(64) });

/** DC-FR-45 (1.18): the API took the draft and its check has started. */
// `run` counts the runs that have finished (DR-BR-16), so a post's first draft answers 0.
export const draftAcceptedSchema = z.object({ deliverableId: z.string().min(1), state: z.literal("checking"), run: z.number().int().nonnegative() });
const draftAcceptedIsTheContracts: SameShape<z.infer<typeof draftAcceptedSchema>, components["schemas"]["DraftAccepted"]> = true;
void draftAcceptedIsTheContracts;

// PP 1.3: the brand's deal and post are the contract's `BrandDeal` and `BrandPost`, checked both ways at compile time.
const brandDealIsTheContracts: SameShape<z.infer<typeof brandDealSchema>, components["schemas"]["BrandDeal"]> = true;
const brandPostIsTheContracts: SameShape<z.infer<typeof brandDeliverableSchema>, components["schemas"]["BrandPost"]> = true;
void brandDealIsTheContracts;
void brandPostIsTheContracts;
