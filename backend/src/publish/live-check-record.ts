/**
 * What every live check ends with, whichever platform the post is on (publish to paid spec PT-FR-14;
 * Instagram Reels spec IG-FR-25): the one answer is given to the money path, which alone decides what
 * follows; each item's result and the answer are recorded with when the check ran; and if the money
 * path now waits on the brand, the brand is told. Nothing here decides a result or moves money.
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { TermsSnapshot } from "../invites/terms";
import { enqueue } from "../jobs/jobs";
import type { Money } from "../money/money";
import type { LiveAnswer, LiveItem, LiveItemResult } from "./live-check";
import type { Notices } from "./notices";

/**
 * Starts a live check of a post, in the transaction of the change that calls for one (PT-FR-11). The
 * first time, `at` is recorded as the moment the video was first seen public (PT-FR-10). With a check
 * already waiting to run, there is still only that one.
 */
export async function startLiveCheckIn(tx: Prisma.TransactionClient, deliverableId: string, at: Date): Promise<{ seenPublicAt: Date }> {
  // One at a time for a post, so two requests at once cannot start two checks.
  const [video] = await tx.$queryRaw<{ seenPublicAt: Date | null }[]>`SELECT "seenPublicAt" FROM "PostVideo" WHERE "deliverableId" = ${deliverableId} FOR UPDATE`;
  if (!video) throw new Error("A live check was asked for a post with no video recorded");
  const seenPublicAt = video.seenPublicAt ?? at;
  if (!video.seenPublicAt) await tx.postVideo.update({ where: { deliverableId }, data: { seenPublicAt } });

  const check = await tx.liveCheck.findUnique({ where: { deliverableId } });
  if (check?.running) return { seenPublicAt };
  await tx.liveCheck.upsert({ where: { deliverableId }, create: { deliverableId, running: true }, update: { running: true, blockedBy: null } });
  await enqueue(tx, { name: "live_check", payload: { deliverableId }, runAt: at });
  return { seenPublicAt };
}

/** The kinds of checklist item that are checked on the published post, not on the draft. */
export const LIVE_KINDS = ["written", "disclosure", "publication"];

/** The items of the agreed checklist that are checked on the published post, in the checklist's order. */
export async function liveItemsOf(prisma: PrismaClient, deliverableId: string, deal: { id: string; agreedVersion: number | null }): Promise<LiveItem[]> {
  const version = await prisma.termsVersion.findFirst({ where: { dealId: deal.id, number: deal.agreedVersion ?? -1 } });
  if (!version) throw new Error("A post at its live check has no agreed checklist");
  return (version.terms as unknown as TermsSnapshot).items
    .filter((item) => item.deliverableId === deliverableId && LIVE_KINDS.includes(item.kind))
    .map((item) => ({ id: item.id, name: item.name, kind: item.kind as LiveItem["kind"], ...(item.exact ? { exact: item.exact } : {}) }));
}

/** What a finished live check found, whatever it looked at. */
export interface Found {
  answer: LiveAnswer;
  items: LiveItemResult[];
  notFixable?: string;
  undecided: string[];
}

export interface AnswerDeps {
  prisma: PrismaClient;
  now: () => Date;
  money: Pick<Money, "liveCheckResult">;
  /** Told when one of the brand's 48 hours starts, so it is given a link and an email (PT-FR-20, PT-FR-21). */
  notices?: Pick<Notices, "windowStarted">;
  /** Told what a live check did, with ids and codes only. Never a description or a caption. */
  log?: (message: string, details: Record<string, unknown>) => void;
}

/**
 * Gives the money path a finished check's answer, then records it. The answer goes first: if this
 * stops in between, the job runs again and the money path is told the same.
 */
export async function giveAnswer(deps: AnswerDeps, deliverableId: string, found: Found, post: { id: string; date?: Date }): Promise<void> {
  const { prisma, now, money } = deps;
  const answered = await money.liveCheckResult(deliverableId, found.answer);
  const at = now();
  await prisma.$transaction([
    prisma.liveCheckItem.deleteMany({ where: { deliverableId } }),
    prisma.liveCheckItem.createMany({
      data: found.items.map((item, position) => ({ deliverableId, itemId: item.id, position, result: item.result, checkedBy: item.checkedBy, evidence: item.evidence, hint: item.hint })),
    }),
    prisma.liveCheck.update({
      where: { deliverableId },
      data: { running: false, blockedBy: null, answer: found.answer, notFixable: found.notFixable ?? null, undecided: found.undecided, ranAt: at, videoDate: post.date ?? null, runs: { increment: 1 } },
    }),
  ]);
  // If the money path now waits on the brand, the brand is told. Asked again for the same window, nothing new is made.
  const waiting = answered.ok ? answered.money.waitingOn : null;
  if (waiting?.for === "brand_to_confirm") await deps.notices?.windowStarted(deliverableId, "confirm", waiting.until);
  if (waiting?.for === "brand_to_accept") await deps.notices?.windowStarted(deliverableId, "accept", waiting.until);
  deps.log?.("A live check finished", { deliverableId, videoId: post.id, answer: found.answer, taken: answered.ok, ...(answered.ok ? {} : { refused: answered.reason }) });
}
