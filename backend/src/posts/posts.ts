/**
 * One post as its creator sees it at the draft check (draft check and review spec DR-FR-25 to
 * DR-FR-29). It reads and decides nothing: the checklist is the one the brand agreed to, each item's
 * status comes from the review rules, and the hold is as the money path has it.
 */
import { howChecked, type CheckedBy, type CheckItem as ChecklistItem } from "../checks/check";
import type { BriefLine } from "../briefs/reader";
import type { Platform } from "../deals/deals";
import type { FileFailure } from "../drafts/drafts";
import type { PrismaClient } from "../generated/prisma/client";
import { cents, type TermsSnapshot } from "../invites/terms";
import type { Money } from "../money/money";
import { decimal } from "../money/view";
import type { ReviewLink, ReviewLinks } from "../review/links";
import { askable, brandReview, brandStatus, creatorStatus, newReview, postState, type BrandStatus, type CreatorStatus, type ReviewItem } from "../review/rules";
import { holdEnded, loadReview } from "../review/store";
import type { Storage } from "../storage/port";

/** How an item reads on the creator's page. Before a run it is not checked yet; during one it is being checked. */
export type PostItemStatus = CreatorStatus | "not_checked" | "checking";

export interface PostItem {
  id: string;
  name: string;
  kind: ChecklistItem["kind"];
  status: PostItemStatus;
  previousStatus?: CreatorStatus;
  /** The brief line it cites. Absent only for an item the creator added. */
  briefLine?: BriefLine;
  evidence?: { label: string; text: string; startSec: number; endSec: number };
  checkedBy: CheckedBy;
  /** Whether the creator may ask the brand to accept it now. Present once it has a result. */
  askable?: boolean;
  /** When the creator asked the brand about it, while the ask stands. */
  askedAt?: string;
  /** The brand asked for it to be fixed, so it cannot be asked about again in this run. */
  declined?: boolean;
  /** The brand's note, with its request for a fix or its objection. Plain text (DR-BR-09). */
  brandNote?: string;
  /** One plain sentence saying what to change. Guidance only. */
  fixHint?: string;
}

/** The latest draft, with an address that plays it for a short time (DR-FR-27). */
export interface PostDraft {
  fileName: string;
  durationSec: number;
  url: string;
  urlExpiresAt: string;
}

export type CheckFailure =
  | { kind: "ours"; retrying: boolean; fileName: string }
  | { kind: "file"; reason: FileFailure["reason"]; fileName: string; lengthSec?: number; lengthCapSec?: number };

/** A post's state: as the review rules have it, or "posting" once the creator has a go-ahead to publish (PT-FR-25). */
export type PostState = ReturnType<typeof postState> | "posting";

/** The go-ahead as the money path has it, in the words the creator's page uses (PT-FR-24). */
export type PostGoAhead = { state: "go"; endsAt: string } | { state: "wait"; until: string } | { state: "confirming" | "not_confirmed" | "ended" };

export interface CreatorPost {
  id: string;
  brandName: string;
  platform: Platform;
  state: PostState;
  /** 23:59 on the deadline's day in the creator's timezone, fixed when the hold was approved. */
  deadline: string;
  creatorTimeZone: string;
  run: number;
  items: PostItem[];
  brief: BriefLine[];
  draft?: PostDraft;
  hold: { amountMinor: number; currency: "USD"; reference: string; heldAt: string; stage: "held" | "confirmed" | "captured" | "paid" };
  /** Where the payout goes. For the creator only (DR-BR-13). */
  payoutEmail: string;
  /** Whether the creator may publish now, once they have asked. Absent before they ask. */
  goAhead?: PostGoAhead;
  reviewWindowEndsAt?: string;
  objectedAt?: string;
  approvedAt?: string;
  approvedBy?: "brand" | "window";
  /** The brand's link to this draft's review, while the brand has something to do. For the creator only (DR-FR-45). */
  reviewLink?: ReviewLink;
  /** When the brand first opened this draft (DR-FR-46). */
  reviewOpenedAt?: string;
  checkFailure?: CheckFailure;
  checkStartedAt?: string;
  stages?: { name: string; status: "done" | "current" | "waiting" }[];
  releasedAt?: string;
  releaseReason?: "deadline" | "cancelled" | "day_28" | "fix_window_ended" | "not_accepted" | "ruled_not_to_pay" | "hold_not_confirmed";
}

type ReleaseReason = NonNullable<CreatorPost["releaseReason"]>;

/** One post's review as the brand sees it (DR-FR-47): only the latest draft's facts, and only once it is shown one. */
export interface BrandPost {
  dealId: string;
  deliverableId: string;
  creatorName: string;
  brandName: string;
  platform: Platform;
  creatorTimeZone: string;
  hold: { amount: string; reference: string; deadline: string };
  review:
    | { state: "nothing_yet" | "asked" }
    | { state: "window"; endsAt: string }
    | { state: "objected"; objectedAt: string }
    | { state: "approved"; approvedAt: string; by: "brand" | "window" }
    | { state: "released"; releasedAt: string; reason: ReleaseReason };
  draft?: {
    url: string;
    urlExpiresAt: string;
    durationSec: number;
    items: {
      id: string;
      name: string;
      kind: ChecklistItem["kind"];
      checkedBy: CheckedBy;
      status: BrandStatus;
      briefLine?: BriefLine;
      evidence?: { label: string; text: string; startSec: number; endSec: number };
      /** The brand's own note on an item it asked to be fixed or objected to. */
      note?: string;
    }[];
  };
}

/** Where a post's review stands on the brand's deal page, with how many items wait on the brand or are objected to (DR-FR-49). */
export type ReviewSummary =
  | { state: "nothing_yet" | "approved" | "released" }
  | { state: "asked" | "objected"; count: number }
  | { state: "window"; endsAt: string };

/** What the deals list needs of a post: its state, and whether its next step is the creator's (DR-FR-28). */
export interface PostSummary {
  state: PostState;
  needsCreator: boolean;
}

/** The check's stages in order, in the words the page shows (DR-FR-10). */
const STAGES = [
  ["reading", "Reading the video"],
  ["said", "Checking what was said and written on screen"],
  ["shown", "Checking what is shown"],
  ["confirming", "Confirming the evidence"],
] as const;

const LIVE_KINDS = ["written", "disclosure", "publication"];

export type Posts = ReturnType<typeof createPosts>;

export function createPosts(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** Where drafts are kept. Without it no draft exists, so none is shown. */
  storage?: Storage;
  money?: Pick<Money, "creatorView" | "view">;
  /** The brand's review links, to show the creator the one for their draft. */
  links?: Pick<ReviewLinks, "current">;
  /** How long an address that plays a draft works for (DR-BR-12). */
  addressSeconds?: number;
}) {
  const { prisma, now, storage, money, links } = deps;
  const addressSeconds = deps.addressSeconds ?? 15 * 60;

  const isReleased = holdEnded;
  const reasonOf = (reason: string): ReleaseReason => (reason === "cleared_ruled" ? "ruled_not_to_pay" : (reason as ReleaseReason));

  /** The post's latest draft with a fresh address, if it has one. */
  async function draftOf(draftId: string | null | undefined): Promise<PostDraft | undefined> {
    if (!draftId || !storage) return undefined;
    const draft = await prisma.draft.findUnique({ where: { id: draftId } });
    if (!draft) return undefined;
    const at = now();
    return {
      fileName: draft.fileName,
      durationSec: draft.durationSec,
      url: await storage.address(draft.storageKey, addressSeconds),
      urlExpiresAt: new Date(at.getTime() + addressSeconds * 1000).toISOString(),
    };
  }

  /** Whether a post's next step is its creator's: nothing sent yet, something to fix or decide, or a draft to post. */
  function needsCreator(state: PostState, items: ReviewItem[]): boolean {
    if (state === "no_draft" || state === "objected" || state === "check_failed" || state === "approved" || state === "posting") return true;
    return state === "results" && items.some((item) => ["fix_needed", "unsure"].includes(creatorStatus(item)));
  }

  return {
    /** One post, for its creator (DR-FR-25). A post with no hold yet has no page: there is nothing to check a draft for. */
    async creatorPost(creatorId: string, deliverableId: string): Promise<CreatorPost | { refused: "not_found" | "not_held" }> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } }, include: { deal: true } });
      if (!post) return { refused: "not_found" };
      const view = await money?.creatorView(deliverableId);
      if (!view || view.hold.state !== "held") return { refused: "not_held" };
      const { deal } = post;
      const version = await prisma.termsVersion.findFirst({ where: { dealId: deal.id, number: deal.agreedVersion ?? -1 } });
      if (!version) return { refused: "not_held" };
      const checklist = (version.terms as unknown as TermsSnapshot).items.filter((item) => item.deliverableId === deliverableId);
      const brief = (deal.briefLines ?? []) as unknown as BriefLine[];

      const released = isReleased(view.stage);
      const loaded = await loadReview(prisma, deliverableId, released);
      const review = loaded?.state ?? { ...newReview(), released };
      const row = loaded?.row;
      const results = new Map((loaded?.items ?? []).map((item) => [item.itemId, item]));
      // While a newer draft is checked, every draft-check item reads as checking. Its results arrive together.
      const showResults = review.phase !== "checking" || released;

      const items = checklist.map((agreed): PostItem => {
        const kind = agreed.kind as ChecklistItem["kind"];
        const base = {
          id: agreed.id,
          name: agreed.name,
          kind,
          ...(agreed.briefLine === undefined ? {} : { briefLine: brief.find((line) => line.number === agreed.briefLine) ?? { number: agreed.briefLine, text: "" } }),
        };
        const found = results.get(agreed.id);
        const item = review.items.find((each) => each.id === agreed.id);
        if (!found || !item || !showResults) {
          const status = LIVE_KINDS.includes(kind) ? "at_live_check" : review.phase === "checking" ? "checking" : "not_checked";
          return { ...base, status, checkedBy: howChecked({ kind, exact: agreed.exact }) };
        }
        return {
          ...base,
          status: creatorStatus(item),
          ...(item.previous ? { previousStatus: item.previous } : {}),
          ...(found.evidence ? { evidence: found.evidence as unknown as PostItem["evidence"] } : {}),
          checkedBy: found.checkedBy as CheckedBy,
          askable: askable(review, item),
          ...(item.ask === "waiting" && found.askedAt ? { askedAt: found.askedAt.toISOString() } : {}),
          ...(item.ask === "declined" ? { declined: true } : {}),
          ...(found.brandNote ? { brandNote: found.brandNote } : {}),
          ...(found.hint ? { fixHint: found.hint } : {}),
        };
      });

      const draft = await draftOf(row?.draftId);
      const fileFailure = row?.fileFailure as unknown as FileFailure | null | undefined;
      const fileName = draft?.fileName ?? "draft";
      const checkFailure: CheckFailure | undefined =
        review.phase === "check_failed"
          ? { kind: "ours", retrying: false, fileName }
          : review.phase === "checking" && (row?.failures ?? 0) > 0
            ? { kind: "ours", retrying: true, fileName }
            : fileFailure
              ? { kind: "file", ...fileFailure }
              : undefined;

      const reviewed = postState(review);
      const asked = view.goAhead;
      const goAhead: PostGoAhead | undefined =
        asked.state === "running"
          ? { state: "go", endsAt: asked.until.toISOString() }
          : asked.state === "wait_until"
            ? { state: "wait", until: asked.until.toISOString() }
            : asked.state === "none"
              ? undefined
              : { state: asked.state };
      // "Posting" only while the money path's go-ahead is running. It is the money path's word, shown as it is (PT-BR-05).
      const state: PostState = reviewed === "approved" && goAhead?.state === "go" ? "posting" : reviewed;
      const reviewLink = await links?.current(deliverableId);
      const current = Math.max(0, STAGES.findIndex(([stage]) => stage === row?.stage));
      const release = view.release;
      const { hold } = view;

      return {
        id: post.id,
        brandName: deal.brandName,
        platform: post.platform as Platform,
        // A file that could not be checked, with no run before it, leaves nothing else to show but the failure.
        state: state === "no_draft" && checkFailure?.kind === "file" ? "check_failed" : state,
        deadline: hold.deadlineAt.toISOString(),
        creatorTimeZone: deal.timezone ?? "UTC",
        run: review.run,
        items,
        brief,
        ...(draft ? { draft } : {}),
        hold: {
          amountMinor: cents(view.amounts.amount) ?? 0,
          currency: "USD",
          reference: hold.reference,
          heldAt: hold.heldAt.toISOString(),
          stage: view.stage === "paid" || view.stage === "captured" ? view.stage : view.goAhead.state === "running" ? "confirmed" : "held",
        },
        payoutEmail: view.payoutEmail,
        ...(goAhead ? { goAhead } : {}),
        ...(review.window ? { reviewWindowEndsAt: review.window.endsAt.toISOString() } : {}),
        ...(review.objectedAt ? { objectedAt: review.objectedAt.toISOString() } : {}),
        ...(review.approved ? { approvedAt: review.approved.at.toISOString(), approvedBy: review.approved.by } : {}),
        ...(reviewLink ? { reviewLink } : {}),
        ...(row?.reviewOpenedAt && review.shown ? { reviewOpenedAt: row.reviewOpenedAt.toISOString() } : {}),
        ...(checkFailure ? { checkFailure } : {}),
        ...(review.phase === "checking" && !released && row?.checkStartedAt
          ? {
              checkStartedAt: row.checkStartedAt.toISOString(),
              stages: STAGES.map(([, name], index) => ({ name, status: index < current ? ("done" as const) : index === current ? ("current" as const) : ("waiting" as const) })),
            }
          : {}),
        ...(released && release
          ? { releasedAt: release.at.toISOString(), releaseReason: reasonOf(release.reason) }
          : {}),
      };
    },

    /**
     * One post's review, for a caller already known to hold a brand's session for the deal (DR-FR-47).
     * The post must be in that deal. The draft is included only while the brand is shown it: from the
     * first ask or the window's start of the latest run, and not once the hold is released (DR-FR-48).
     * It never carries a suggestion, an earlier status, the run number or the PayPal email (DR-BR-13).
     */
    async brandPost(dealId: string, deliverableId: string): Promise<BrandPost | { refused: "not_found" | "not_held" }> {
      const post = await prisma.deliverable.findFirst({
        where: { id: deliverableId, dealId },
        include: { deal: { include: { creator: { select: { name: true } } } } },
      });
      if (!post) return { refused: "not_found" };
      // The plain money view: it holds no PayPal email at all.
      const view = await money?.view(deliverableId);
      if (!view || view.hold.state !== "held") return { refused: "not_held" };
      const { deal } = post;
      const version = await prisma.termsVersion.findFirst({ where: { dealId, number: deal.agreedVersion ?? -1 } });
      if (!version) return { refused: "not_held" };
      const checklist = (version.terms as unknown as TermsSnapshot).items.filter((item) => item.deliverableId === deliverableId);
      const brief = (deal.briefLines ?? []) as unknown as BriefLine[];

      const released = isReleased(view.stage);
      const loaded = await loadReview(prisma, deliverableId, released);
      const review = loaded?.state ?? { ...newReview(), released };
      const results = new Map((loaded?.items ?? []).map((item) => [item.itemId, item]));
      const where = brandReview(review);
      const shown = review.shown && review.phase === "done" && !released ? await draftOf(loaded?.row.draftId) : undefined;

      return {
        dealId,
        deliverableId,
        creatorName: deal.creator.name,
        brandName: deal.brandName,
        platform: post.platform as Platform,
        creatorTimeZone: deal.timezone ?? "UTC",
        hold: { amount: view.amounts.amount, reference: view.hold.reference, deadline: view.hold.deadlineAt.toISOString() },
        review:
          where.state === "released"
            ? { state: "released", releasedAt: (view.release?.at ?? now()).toISOString(), reason: reasonOf(view.release?.reason ?? "cancelled") }
            : where.state === "approved"
              ? { state: "approved", approvedAt: where.approvedAt.toISOString(), by: where.by }
              : where.state === "objected"
                ? { state: "objected", objectedAt: where.objectedAt.toISOString() }
                : where.state === "window"
                  ? { state: "window", endsAt: where.endsAt.toISOString() }
                  : { state: where.state },
        ...(shown
          ? {
              draft: {
                url: shown.url,
                urlExpiresAt: shown.urlExpiresAt,
                durationSec: shown.durationSec,
                items: checklist.flatMap((agreed) => {
                  const found = results.get(agreed.id);
                  const item = review.items.find((each) => each.id === agreed.id);
                  if (!found || !item) return [];
                  return [
                    {
                      id: agreed.id,
                      name: agreed.name,
                      kind: agreed.kind as ChecklistItem["kind"],
                      checkedBy: found.checkedBy as CheckedBy,
                      status: brandStatus(item),
                      ...(agreed.briefLine === undefined ? {} : { briefLine: brief.find((line) => line.number === agreed.briefLine) ?? { number: agreed.briefLine, text: "" } }),
                      ...(found.evidence ? { evidence: found.evidence as unknown as { label: string; text: string; startSec: number; endSec: number } } : {}),
                      ...(found.brandNote ? { note: found.brandNote } : {}),
                    },
                  ];
                }),
              },
            }
          : {}),
      };
    },

    /** A fresh address for the latest draft (DR-FR-27). */
    async draftAddress(creatorId: string, deliverableId: string): Promise<PostDraft | { refused: "not_found" | "no_draft" }> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const row = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      return (await draftOf(row?.draftId)) ?? { refused: "no_draft" };
    },

    /**
     * Where each held post's review stands, for the brand's deal page (DR-FR-49). A post with no hold
     * yet has no review and is left out.
     */
    async reviews(deliverableIds: string[]): Promise<Map<string, ReviewSummary>> {
      const found = new Map<string, ReviewSummary>();
      for (const deliverableId of deliverableIds) {
        const view = await money?.view(deliverableId);
        if (!view || view.hold.state !== "held") continue;
        const review = (await loadReview(prisma, deliverableId, isReleased(view.stage)))?.state ?? { ...newReview(), released: isReleased(view.stage) };
        const where = brandReview(review);
        found.set(
          deliverableId,
          where.state === "asked"
            ? { state: "asked", count: review.items.filter((item) => item.ask === "waiting").length }
            : where.state === "objected"
              ? { state: "objected", count: review.items.filter((item) => item.objected).length }
              : where.state === "window"
                ? { state: "window", endsAt: where.endsAt.toISOString() }
                : { state: where.state },
        );
      }
      return found;
    },

    /** Each post's state, and whether its next step is the creator's, for the deals list (DR-FR-28). */
    async summaries(deliverableIds: string[]): Promise<Map<string, PostSummary>> {
      const found = new Map<string, PostSummary>();
      for (const deliverableId of deliverableIds) {
        const view = await money?.view(deliverableId);
        const released = isReleased(view?.stage);
        const review = (await loadReview(prisma, deliverableId, released))?.state ?? { ...newReview(), released };
        const reviewed = postState(review);
        const state: PostState = reviewed === "approved" && view?.goAhead.state === "running" ? "posting" : reviewed;
        found.set(deliverableId, { state, needsCreator: needsCreator(state, review.items) });
      }
      return found;
    },
  };
}
