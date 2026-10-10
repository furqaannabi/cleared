/**
 * Publishing (publish to paid spec PT-FR-01 to PT-FR-10): the creator asks for the go-ahead with the
 * video on their channel, and says when it is public. Cleared reads the video from YouTube each time.
 * For the go-ahead it must be the approved draft's file on the creator's own channel, and only then is
 * the money path asked, which alone decides whether there is a go-ahead (PT-BR-01, PT-BR-05). Once the
 * video is seen public the money path is told, and the live check is started. Nothing is ever written
 * to YouTube (PT-BR-07).
 */
import { ServiceFailed } from "../checks/check";
import type { Judge } from "../checks/ports";
import type { Prisma } from "../generated/prisma/client";
import type { TermsSnapshot } from "../invites/terms";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { Money, MoneyRefusal } from "../money/money";
import type { GoAheadView } from "../money/view";
import { liveCheck, type LiveItem } from "./live-check";
import { createReader, type ReaderDeps } from "./reader";
import { sameFile, videoIdFrom } from "./video";

export type GoAheadRefused =
  | { refused: "not_found" }
  | { refused: "not_a_youtube_link" }
  /** The post's draft is not approved, so there is nothing to publish yet. */
  | { refused: "not_approved" }
  /** Cleared cannot read the creator's YouTube: never really connected, revoked, or expired (PT-FR-07). */
  | { refused: "reconnect_youtube" }
  /** YouTube itself failed. Nothing was decided; the creator tries again. */
  | { refused: "youtube_unavailable" }
  | { refused: "video_not_found" | "video_private" | "not_your_channel" | "not_the_approved_file" }
  /** The post is published, so the video the live check looks at can no longer be changed (PT-FR-06). */
  | { refused: "already_published" }
  /** The money path refused, with its own reason (MP-FR-10). */
  | { refused: "money"; reason: MoneyRefusal };

export type PostedRefused =
  | { refused: "not_found" }
  /** No video is recorded for the post: the creator has not been through the go-ahead. */
  | { refused: "no_video" }
  /** The recorded video is not public yet. Nothing has changed (PT-FR-08). */
  | { refused: "not_public_yet" }
  | { refused: "reconnect_youtube" | "youtube_unavailable" | "video_not_found" }
  | { refused: "money"; reason: MoneyRefusal };

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

export interface PublishingSettings {
  /** The wait before a live check that could not read YouTube, or reach the judge, tries again. It doubles each time, up to the longest wait (PT-FR-16). */
  retryFirstSeconds: number;
  retryLongestSeconds: number;
}

export const defaultPublishingSettings: PublishingSettings = { retryFirstSeconds: 60, retryLongestSeconds: 3600 };

const LIVE_KINDS = ["written", "disclosure", "publication"];

export type Publishing = ReturnType<typeof createPublishing>;

export function createPublishing(
  deps: ReaderDeps & {
    now: () => Date;
    money?: Pick<Money, "view" | "askGoAhead" | "postPublished" | "liveCheckResult">;
    /** Judges written items that need judgment. Its pass counts only if its quote is in the description (PT-BR-02). */
    judge?: Pick<Judge, "judgeWritten">;
    settings?: PublishingSettings;
    /** Told what a live check did, with ids and codes only. Never a description (PT-BR-12). */
    log?: (message: string, details: Record<string, unknown>) => void;
  },
) {
  const { prisma, now, money, judge, log } = deps;
  const { channelOf, read } = createReader(deps);
  const settings = deps.settings ?? defaultPublishingSettings;

  /** The items of the agreed checklist that are checked on the published post, in the checklist's order. */
  async function liveItems(deliverableId: string, deal: { id: string; agreedVersion: number | null }): Promise<LiveItem[]> {
    const version = await prisma.termsVersion.findFirst({ where: { dealId: deal.id, number: deal.agreedVersion ?? -1 } });
    if (!version) throw new Error("A post at its live check has no agreed checklist");
    return (version.terms as unknown as TermsSnapshot).items
      .filter((item) => item.deliverableId === deliverableId && LIVE_KINDS.includes(item.kind))
      .map((item) => ({ id: item.id, name: item.name, kind: item.kind as LiveItem["kind"], ...(item.exact ? { exact: item.exact } : {}) }));
  }

  /** Ends a check that gave the money path no answer, with the reason if the creator can do something about it (PT-FR-17). */
  async function stop(deliverableId: string, blockedBy: "reconnect_youtube" | "video_not_found" | null): Promise<void> {
    await prisma.liveCheck.update({ where: { deliverableId }, data: { running: false, blockedBy } });
    log?.("A live check gave no answer", { deliverableId, because: blockedBy ?? "nothing_left_to_decide" });
  }

  const handlers: JobHandlers = {
    /**
     * One live check (PT-FR-11 to PT-FR-17). It reads the video's record once, works out each item's
     * result and the one answer in fixed code, gives the money path that answer, and records what it
     * found. A check that could not read the record gives no answer at all (PT-BR-03).
     */
    async live_check(payload, { attempts }) {
      const deliverableId = (payload as { deliverableId?: unknown } | null)?.deliverableId;
      if (typeof deliverableId !== "string") throw new Error("A live check job is missing its deliverableId");
      const [recorded, check] = await Promise.all([prisma.postVideo.findUnique({ where: { deliverableId } }), prisma.liveCheck.findUnique({ where: { deliverableId } })]);
      if (!recorded?.seenPublicAt || !check?.running) return;

      const post = await prisma.deliverable.findUnique({ where: { id: deliverableId }, include: { deal: true } });
      const view = await money?.view(deliverableId);
      // Once the hold is taken or given back there is nothing left for a check to decide.
      if (!post || !money || !judge || view?.stage !== "held") return stop(deliverableId, null);

      const tryLater = { retryAt: new Date(now().getTime() + Math.min(settings.retryFirstSeconds * 2 ** (attempts - 1), settings.retryLongestSeconds) * 1000) };
      const channel = await channelOf(post.deal.creatorId);
      if (!channel) return stop(deliverableId, "reconnect_youtube");
      const video = await read(channel.refreshToken, recorded.videoId);
      if (video === "unavailable") return tryLater;
      if (video === "no_access") return stop(deliverableId, "reconnect_youtube");
      if (video === "not_found") return stop(deliverableId, "video_not_found");

      // The money path takes a result only for a post it knows is published (MP-FR-16). Telling it twice changes nothing.
      if (!view.publishedAt && !(await money.postPublished(deliverableId, recorded.seenPublicAt)).ok) return stop(deliverableId, null);

      const approved = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      const draft = approved?.draftId ? await prisma.draft.findUnique({ where: { id: approved.draftId } }) : null;
      if (!draft) throw new Error("A post at its live check has no approved draft");
      const items = await liveItems(deliverableId, post.deal);

      let found;
      try {
        found = await liveCheck({ video, channelId: channel.channelId, draft, items, judgeWritten: (input) => judge.judgeWritten(input) });
      } catch (error) {
        // The judge could not be reached. Nothing was decided, so nothing is said (PT-BR-03).
        if (error instanceof ServiceFailed) return tryLater;
        throw error;
      }

      // The answer first, then the record of it. If this stops in between, the job runs again and the money path is told the same.
      const answered = await money.liveCheckResult(deliverableId, found.answer);
      const at = now();
      await prisma.$transaction([
        prisma.liveCheckItem.deleteMany({ where: { deliverableId } }),
        prisma.liveCheckItem.createMany({
          data: found.items.map((item, position) => ({ deliverableId, itemId: item.id, position, result: item.result, checkedBy: item.checkedBy, evidence: item.evidence, hint: item.hint })),
        }),
        prisma.liveCheck.update({
          where: { deliverableId },
          data: { running: false, blockedBy: null, answer: found.answer, notFixable: found.notFixable ?? null, undecided: found.undecided, ranAt: at, videoDate: video.publishedAt ?? null, runs: { increment: 1 } },
        }),
      ]);
      log?.("A live check finished", { deliverableId, videoId: recorded.videoId, answer: found.answer, taken: answered.ok, ...(answered.ok ? {} : { refused: answered.reason }) });
    },
  };

  return {
    /** The jobs this module schedules. */
    handlers,

    /**
     * Asks for the go-ahead (PT-FR-01 to PT-FR-07). In order: the post and its approved draft, the
     * video read from YouTube and matched to that draft's file, the video recorded for the post, and
     * then the money path's own answer. PayPal is asked nothing until the video is accepted.
     */
    async askGoAhead(creatorId: string, deliverableId: string, videoUrl: string): Promise<{ goAhead: GoAheadView } | GoAheadRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const videoId = videoIdFrom(videoUrl);
      if (!videoId) return { refused: "not_a_youtube_link" };

      const check = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      const draft = check?.approvedAt && check.draftId ? await prisma.draft.findUnique({ where: { id: check.draftId } }) : null;
      if (!draft) return { refused: "not_approved" };
      // A hold that has been released or taken has no go-ahead to give. The money path says so before YouTube is asked.
      const stage = (await money?.view(deliverableId))?.stage;
      if (!money || stage !== "held") return { refused: "money", reason: "not_held" };
      const recorded = await prisma.postVideo.findUnique({ where: { deliverableId } });
      if (recorded?.seenPublicAt && recorded.videoId !== videoId) return { refused: "already_published" };

      const channel = await channelOf(creatorId);
      if (!channel) return { refused: "reconnect_youtube" };
      const video = await read(channel.refreshToken, videoId);
      if (video === "no_access") return { refused: "reconnect_youtube" };
      if (video === "unavailable") return { refused: "youtube_unavailable" };
      if (video === "not_found") return { refused: "video_not_found" };
      if (video.privacy === "private") return { refused: "video_private" };
      if (video.channelId !== channel.channelId) return { refused: "not_your_channel" };
      const fileMatch = sameFile(draft, video);
      if (fileMatch === "different") return { refused: "not_the_approved_file" };

      // The video is accepted. It is the one the live check will look at, until the creator gives another.
      const at = now();
      await prisma.postVideo.upsert({
        where: { deliverableId },
        create: { deliverableId, videoId, fileMatch, recordedAt: at },
        update: { videoId, fileMatch, recordedAt: at },
      });

      const asked = await money.askGoAhead(deliverableId);
      return asked.ok ? { goAhead: asked.goAhead } : { refused: "money", reason: asked.reason };
    },

    /**
     * "I've posted it" (PT-FR-08). The recorded video is read at once. If it is public, the moment is
     * recorded as when the post was published (PT-FR-10), the live check is started, and the money path
     * is told. If it is not, nothing changes. A check already started, or finished, is left as it is.
     */
    async posted(creatorId: string, deliverableId: string): Promise<{ publishedAt: Date } | PostedRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const recorded = await prisma.postVideo.findUnique({ where: { deliverableId } });
      if (!recorded) return { refused: "no_video" };
      const stage = (await money?.view(deliverableId))?.stage;
      if (!money || stage !== "held") return { refused: "money", reason: "not_held" };

      const check = await prisma.liveCheck.findUnique({ where: { deliverableId } });
      if (recorded.seenPublicAt && check && (check.running || check.answer)) return { publishedAt: recorded.seenPublicAt };

      const channel = await channelOf(creatorId);
      if (!channel) return { refused: "reconnect_youtube" };
      const video = await read(channel.refreshToken, recorded.videoId);
      if (video === "no_access") return { refused: "reconnect_youtube" };
      if (video === "unavailable") return { refused: "youtube_unavailable" };
      if (video === "not_found") return { refused: "video_not_found" };
      if (video.privacy !== "public") return { refused: "not_public_yet" };

      const { seenPublicAt } = await prisma.$transaction((tx) => startLiveCheckIn(tx, deliverableId, now()));
      // The money path's own record of it (MP-FR-16). The live check tells it again before it answers, so a failure here loses nothing.
      const told = await money.postPublished(deliverableId, seenPublicAt);
      return told.ok ? { publishedAt: seenPublicAt } : { refused: "money", reason: told.reason };
    },

    /**
     * The creator has connected YouTube again (PT-FR-17). Every live check of theirs that stopped
     * because their channel could not be read is started again.
     */
    async youtubeConnected(creatorId: string): Promise<void> {
      const stopped = await prisma.liveCheck.findMany({ where: { blockedBy: "reconnect_youtube", running: false }, select: { deliverableId: true } });
      const theirs = await prisma.deliverable.findMany({ where: { id: { in: stopped.map((check) => check.deliverableId) }, deal: { creatorId } }, select: { id: true } });
      for (const post of theirs) await prisma.$transaction((tx) => startLiveCheckIn(tx, post.id, now()));
    },

    /**
     * "Check again" (PT-FR-15): a fresh live check of a post that failed on something the creator can
     * fix, while the money path's time to fix it is open. Whether it is open is the money path's to
     * say. The last results stay until the new check finishes.
     */
    async checkAgain(creatorId: string, deliverableId: string): Promise<{ started: true } | { refused: "not_found" | "not_in_fix_window" }> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const waitingOn = (await money?.view(deliverableId))?.waitingOn;
      const at = now();
      if (waitingOn?.for !== "creator_to_fix" || at >= waitingOn.until) return { refused: "not_in_fix_window" };
      await prisma.$transaction((tx) => startLiveCheckIn(tx, deliverableId, at));
      return { started: true };
    },
  };
}
