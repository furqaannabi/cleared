/**
 * Drafts: the video a creator sends for a held post before publishing, the limits on sending them, and
 * the job that checks one (draft check and review spec DR-FR-01 to DR-FR-24). Whether a draft may be
 * sent, and what a finished run means for the post, is decided by the review rules; what each item's
 * result is, by the check. This module joins them to storage, the database and the jobs table.
 */
import { keepHeard } from "./heard";
import { endedAt } from "./retention";
import { checkDraft, ServiceFailed, type CheckItem as ChecklistItem, type ItemResult, type Stage } from "../checks/check";
import type { Judge, SpeechAndText, VideoModel } from "../checks/ports";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { TermsSnapshot } from "../invites/terms";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { Media } from "../media/port";
import type { Money } from "../money/money";
import type { ReviewLinks } from "../review/links";
import { defaultReviewSettings, review, type ReviewSettings } from "../review/rules";
import { applyEffects, loadReview, lockReview, saveItems, saveState } from "../review/store";
import type { Storage } from "../storage/port";

const EXPIRE_JOB = "drafts_expire";

export interface DraftSettings {
  /** The largest file taken, in bytes, and the longest video, in seconds (DR-FR-02, DR-FR-03). */
  maxBytes: number;
  maxSeconds: number;
  /** How many times one post can be checked (DR-FR-06). */
  maxChecks: number;
  /** How much video is checked in a day across everyone, in seconds (DR-FR-07). */
  dailySeconds: number;
  /** How long an address that reads a draft works for (DR-BR-12). */
  addressSeconds: number;
  /** How many times a check that failed on Sponing's side is tried again, and the first wait before one (DR-FR-23). */
  retries: number;
  retryWaitSeconds: number;
  /** How often the reading of a video is asked after, and how long it may take before it counts as failed. */
  pollSeconds: number;
  readingLimitSeconds: number;
  /** How many days after a post ends its drafts, and everything read from them, are kept (AH-FR-23). */
  keepDaysAfterEnd: number;
  review: ReviewSettings;
}

export const defaultDraftSettings: DraftSettings = {
  maxBytes: 1024 ** 3,
  maxSeconds: 15 * 60,
  maxChecks: 10,
  dailySeconds: 300 * 60,
  addressSeconds: 15 * 60,
  retries: 3,
  retryWaitSeconds: 30,
  pollSeconds: 10,
  readingLimitSeconds: 30 * 60,
  keepDaysAfterEnd: 30,
  review: defaultReviewSettings,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_NAME_MAX = 200;
const secondsAfter = (from: Date, seconds: number) => new Date(from.getTime() + seconds * 1000);

/** Why a file could not be checked because of the file itself (DR-FR-03). */
export type FileFailure =
  | { reason: "unreadable" | "format"; fileName: string }
  | { reason: "too_long"; fileName: string; lengthSec: number; lengthCapSec: number };

export type DraftRefused =
  | { refused: "not_found" }
  /** The post has no hold in place, or its hold has been released or closed (DR-FR-01). */
  | { refused: "not_held" | "released" }
  /** A check is running, or a draft is already approved (DR-FR-01). */
  | { refused: "check_running" | "approved" }
  /** A limit on drafts was reached (DR-FR-09). `resetsAt` is when the daily one lifts. */
  | { refused: "limit"; limit: "post" | "overall"; resetsAt?: Date }
  | { refused: "too_large" }
  | { refused: "file"; failure: FileFailure };

export type RetryRefused = { refused: "not_found" | "not_held" | "released" } | /** No check of this post failed on Sponing's side. */ { refused: "no_failed_check" };

export interface DraftAccepted {
  deliverableId: string;
  state: "checking";
  /** How many runs have finished so far. The one just started is not one yet. */
  run: number;
}

/** The services a check asks. Left out when they are not set up: every check then fails on Sponing's side. */
export interface CheckServices {
  speech: SpeechAndText;
  judge: Judge;
  videoModel: VideoModel;
}

/** A file's name as plain text: no control characters, trimmed, and not long. It is shown, never used as a path. */
function plainName(name: string | undefined): string {
  const plain = (name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, FILE_NAME_MAX);
  return plain || "draft";
}

export type Drafts = ReturnType<typeof createDrafts>;

export function createDrafts(deps: {
  prisma: PrismaClient;
  now: () => Date;
  storage: Storage;
  media: Media;
  checks?: CheckServices;
  /** The brand's review links, made when a run opens the window and closed when a new draft starts. */
  links?: Pick<ReviewLinks, "make" | "close">;
  /** The money path, read to know whether a post's hold is in place. Without it no post is held. */
  money?: Pick<Money, "view">;
  settings?: DraftSettings;
  /** Where a failed check is reported: ids, counts and the kind of error. Never anything from the video (DR-BR-18). */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, now, storage, media, checks, money, links } = deps;
  const settings = deps.settings ?? defaultDraftSettings;
  const log = deps.log ?? ((message, details) => console.error(message, JSON.stringify(details)));

  /** Whether the post's hold is in place, as the money path has it. */
  async function holdOf(deliverableId: string): Promise<"held" | "not_held" | "released"> {
    const stage = (await money?.view(deliverableId))?.stage;
    if (stage === "held") return "held";
    return stage === undefined || stage === "not_held" ? "not_held" : "released";
  }

  /**
   * Whether one more draft may be checked: for this post, and across everyone today (DR-FR-06,
   * DR-FR-07). `seconds` is the new draft's length once it is known; before the
   * file has been read it is zero, which asks only whether the day's total is already used up.
   */
  async function limitReached(
    db: Prisma.TransactionClient | PrismaClient,
    post: { run: number },
    seconds: number,
    at: Date,
  ): Promise<Extract<DraftRefused, { refused: "limit" }> | undefined> {
    if (post.run >= settings.maxChecks) return { refused: "limit", limit: "post" };
    const today = { at: { gt: new Date(at.getTime() - DAY_MS) } };
    const used = (await db.draftUsage.aggregate({ where: today, _sum: { seconds: true } }))._sum.seconds ?? 0;
    if (seconds === 0 ? used >= settings.dailySeconds : used + seconds > settings.dailySeconds) {
      // One more is allowed when the oldest draft still counted leaves the day.
      const oldest = await db.draftUsage.findFirst({ where: today, orderBy: { at: "asc" } });
      return { refused: "limit", limit: "overall", resetsAt: oldest ? new Date(oldest.at.getTime() + DAY_MS) : undefined };
    }
    return undefined;
  }

  /**
   * The post's checklist as the brand agreed to it. The check judges a draft against this and nothing
   * else: not the brief, and not anything the creator edited afterwards.
   */
  async function agreedChecklist(deliverableId: string): Promise<ChecklistItem[]> {
    const post = await prisma.deliverable.findUniqueOrThrow({ where: { id: deliverableId }, include: { deal: true } });
    const version = await prisma.termsVersion.findFirst({ where: { dealId: post.dealId, number: post.deal.agreedVersion ?? -1 } });
    if (!version) throw new Error("A post being checked has no agreed checklist");
    const agreed = version.terms as unknown as TermsSnapshot;
    return agreed.items
      .filter((item) => item.deliverableId === deliverableId)
      .map((item) => ({ id: item.id, name: item.name, kind: item.kind as ChecklistItem["kind"], ...(item.exact ? { exact: item.exact } : {}) }));
  }

  /**
   * Records a finished run (DR-FR-21, DR-FR-22): every item's result with its evidence, the run number,
   * and whatever the rules say follows, such as the review window opening. Then the draft it replaced
   * is deleted, file and all (DR-BR-19). Nothing is recorded if the post has moved on meanwhile.
   */
  async function finish(deliverableId: string, draftId: string, results: ItemResult[], at: Date) {
    const replaced = await prisma.$transaction(async (tx) => {
      await lockReview(tx, deliverableId);
      const loaded = await loadReview(tx, deliverableId, false);
      if (!loaded || loaded.row.phase !== "checking" || loaded.row.draftId !== draftId) return [];
      const done = review(loaded.state, { type: "run_finished", at, results: results.map(({ id, result }) => ({ id, result })) }, settings.review);
      if (!done.ok) return [];

      await tx.checkItem.deleteMany({ where: { deliverableId } });
      await tx.checkItem.createMany({
        data: done.state.items.map((item, position) => {
          const found = results.find((result) => result.id === item.id)!;
          return {
            deliverableId,
            itemId: item.id,
            position,
            result: item.result,
            checkedBy: found.checkedBy,
            ...(found.evidence ? { evidence: found.evidence } : {}),
            hint: found.hint,
            previous: item.previous,
          };
        }),
      });
      await saveState(tx, deliverableId, done.state);
      await tx.draftCheck.update({ where: { deliverableId }, data: { stage: null, failures: 0, speechJobId: null } });
      // The first check to finish is recorded as having passed every item or not, once and for good (AH-FR-09).
      // An item that waits for the live check is not one this check could fail.
      if (done.state.run === 1) {
        const passed = done.state.items.every((item) => item.result === "passed" || item.result === "at_live_check");
        await tx.draftCheck.updateMany({ where: { deliverableId, firstCheckPassed: null }, data: { firstCheckPassed: passed } });
      }
      await applyEffects(tx, deliverableId, done.effects, { at, links });

      const older = await tx.draft.findMany({ where: { deliverableId, id: { not: draftId } } });
      await tx.draft.deleteMany({ where: { id: { in: older.map((draft) => draft.id) } } });
      return older;
    });
    // The file, and anything read from it that was stored beside it.
    for (const draft of replaced) await storage.deleteUnder(draft.storageKey);
  }

  /** The jobs this module schedules. */
  const handlers = {
    /**
     * The daily clear-out (AH-FR-23). A post's drafts, with what was said in them and anything else
     * read from them, are deleted once the post has been over for the set number of days. The check's
     * results are not touched: they stay with the deal. Each post is cleared on its own, so one that
     * fails does not hold up the rest. The job always comes back the next day.
     */
    async [EXPIRE_JOB](_payload: unknown, { now: at }: { now: Date }) {
      const kept = await prisma.draft.findMany({ orderBy: { createdAt: "asc" } });
      const byPost = new Map<string, typeof kept>();
      for (const draft of kept) byPost.set(draft.deliverableId, [...(byPost.get(draft.deliverableId) ?? []), draft]);
      let cleared = 0;
      let failed = 0;
      for (const [deliverableId, drafts] of byPost) {
        try {
          const view = await money?.view(deliverableId);
          const ended = view && endedAt(view);
          if (!ended || at.getTime() - ended.getTime() < settings.keepDaysAfterEnd * DAY_MS) continue;
          // The file, and anything read from it that was stored beside it. Then the rows, so a file that could not be deleted is tried again tomorrow.
          for (const draft of drafts) await storage.deleteUnder(draft.storageKey);
          await prisma.draft.deleteMany({ where: { id: { in: drafts.map((draft) => draft.id) } } });
          cleared++;
        } catch (error) {
          failed++;
          log("A post's drafts could not be deleted at the end of their time", { deliverableId, error: error instanceof Error ? error.name : "unknown" });
        }
      }
      if (cleared > 0 || failed > 0) log("Drafts past their time were deleted", { posts: cleared, failed });
      return { retryAt: new Date(at.getTime() + DAY_MS) };
    },

    /**
     * Checks a draft (DR-FR-10 to DR-FR-24). Reading the video takes minutes, so the job starts it and
     * comes back to ask. When the reading is done it checks every item and records the run. A failure
     * on Sponing's side shows nothing of the run: the job waits and tries again, and after the last
     * try the post reports the failure (DR-FR-23).
     */
    async check_draft(payload, { now: at }) {
      const { deliverableId, draftId } = payload as { deliverableId?: unknown; draftId?: unknown };
      if (typeof deliverableId !== "string" || typeof draftId !== "string") throw new Error("A check_draft job is missing its ids");
      const row = await prisma.draftCheck.findUnique({ where: { deliverableId } });
      const draft = await prisma.draft.findUnique({ where: { id: draftId } });
      if (!row || !draft || row.phase !== "checking" || row.draftId !== draftId) {
        // Not the check that is running any more. If nothing of it was analysed, it counts for nothing (DR-BR-16).
        await prisma.draftUsage.deleteMany({ where: { draftId, analysed: false } });
        return;
      }
      // A hold released while the check ran: there is nothing left to check for.
      if ((await holdOf(deliverableId)) !== "held") return;

      const poll = { retryAt: secondsAfter(at, settings.pollSeconds) };
      try {
        if (!checks) throw new ServiceFailed("the checking services, which are not set up");

        if (!row.speechJobId) {
          // From here AWS is charged for the video, so its minutes count whatever happens next (DR-BR-16).
          await prisma.draftUsage.updateMany({ where: { draftId }, data: { analysed: true } });
          const { jobId } = await checks.speech.start(draft.storageKey);
          await prisma.draftCheck.update({ where: { deliverableId }, data: { speechJobId: jobId, stage: "reading" } });
          return poll;
        }

        const read = await checks.speech.result(row.speechJobId);
        if (read.state === "working") {
          const waited = at.getTime() - (row.checkStartedAt ?? at).getTime();
          if (waited > settings.readingLimitSeconds * 1000) throw new ServiceFailed("the reading of the video in time");
          return poll;
        }
        if (read.state === "failed") {
          // The next try reads the video afresh.
          await prisma.draftCheck.update({ where: { deliverableId }, data: { speechJobId: null } });
          throw new ServiceFailed("the reading of the video");
        }

        // What was said is kept beside the draft, so a live Reel can be matched to it without reading it again (IG-FR-21).
        await keepHeard(storage, draft.storageKey, read.speech);

        const address = await storage.address(draft.storageKey, settings.addressSeconds);
        const results = await checkDraft({
          items: await agreedChecklist(deliverableId),
          speech: read.speech,
          screen: read.screen,
          video: { key: draft.storageKey, format: draft.format === "mov" ? "mov" : "mp4", durationSec: draft.durationSec },
          judge: checks.judge,
          videoModel: checks.videoModel,
          frames: (timesSec) => media.frames(address, timesSec),
          onStage: async (stage: Stage) => void (await prisma.draftCheck.updateMany({ where: { deliverableId, draftId }, data: { stage } })),
        });
        await finish(deliverableId, draftId, results, at);
        return;
      } catch (error) {
        const failures = row.failures + 1;
        log("A draft check failed on our side", { deliverableId, draftId, failures, error: error instanceof Error ? error.name : "unknown" });
        if (failures <= settings.retries) {
          await prisma.draftCheck.update({ where: { deliverableId }, data: { failures } });
          return { retryAt: secondsAfter(at, settings.retryWaitSeconds * 2 ** (failures - 1)) };
        }
        await prisma.$transaction(async (tx) => {
          await lockReview(tx, deliverableId);
          const loaded = await loadReview(tx, deliverableId, false);
          if (!loaded || loaded.row.draftId !== draftId) return;
          const failed = review(loaded.state, { type: "run_failed", at }, settings.review);
          if (!failed.ok) return;
          await saveState(tx, deliverableId, failed.state);
          await tx.draftCheck.update({ where: { deliverableId }, data: { stage: null, failures } });
        });
        return;
      }
    },
  } satisfies JobHandlers;

  /**
   * Takes a draft for a held post (DR-FR-01 to DR-FR-05). In order: who is asking and whether the post
   * can take a draft, the limits that need no file, the file put into storage by `store`, the file read
   * to see what it really is, and then, in one transaction, the draft recorded and its check started as
   * a job. A file refused at any point is deleted.
   */
  async function take(
    creatorId: string,
    deliverableId: string,
    name: string | undefined,
    store: (storageKey: string) => Promise<{ bytes: number } | "too_large">,
  ): Promise<DraftAccepted | DraftRefused> {
    const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
    if (!post) return { refused: "not_found" };
    const hold = await holdOf(deliverableId);
    if (hold !== "held") return { refused: hold };

    const at = now();
    const fileName = plainName(name);
    await prisma.draftCheck.upsert({ where: { deliverableId }, create: { deliverableId }, update: {} });
    const before = (await loadReview(prisma, deliverableId, false))!;
    const allowed = review(before.state, { type: "draft_started", at }, settings.review);
    if (!allowed.ok) return { refused: allowed.reason as "check_running" | "approved" };
    const early = await limitReached(prisma, { run: before.row.run }, 0, at);
    if (early) return early;

    const draftId = crypto.randomUUID();
    // The key is the service's own. Nothing of the file's name goes into it.
    const storageKey = `drafts/${deliverableId}/${draftId}`;
    const stored = await store(storageKey);
    if (stored === "too_large") return { refused: "too_large" };

    /** Deletes the file just stored and answers with why it was not taken. */
    const turnedAway = async <Refusal extends DraftRefused>(refusal: Refusal): Promise<Refusal> => {
      await storage.delete(storageKey);
      return refusal;
    };

    // What the file is comes from reading it, never from its name or what the browser said (DR-FR-03).
    const lengthCapSec = settings.maxSeconds;
    const found = await media.probe(await storage.address(storageKey, settings.addressSeconds));
    const failure: FileFailure | undefined =
      found === "unreadable"
        ? { reason: "unreadable", fileName }
        : found.format === "other"
          ? { reason: "format", fileName }
          : found.durationSec > lengthCapSec
            ? { reason: "too_long", fileName, lengthSec: found.durationSec, lengthCapSec }
            : undefined;
    if (failure || found === "unreadable") {
      // A file failure is not a check: only the failure is noted, and everything else stands (DR-FR-04).
      await prisma.draftCheck.update({ where: { deliverableId }, data: { fileFailure: failure as unknown as Prisma.InputJsonValue } });
      return turnedAway({ refused: "file", failure: failure! });
    }

    const refused = await prisma.$transaction(async (tx): Promise<DraftRefused | undefined> => {
      // One draft at a time for a post, and one count of the day's minutes at a time for everyone.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cleared:draft-minutes'))`;
      await lockReview(tx, deliverableId);
      const current = (await loadReview(tx, deliverableId, false))!;
      // A new draft cancels every ask, acceptance and objection, and ends the window (DR-FR-05).
      const start = review(current.state, { type: "draft_started", at }, settings.review);
      if (!start.ok) return { refused: start.reason as "check_running" | "approved" };
      const limit = await limitReached(tx, { run: current.row.run }, found.durationSec, at);
      if (limit) return limit;

      await tx.draft.create({
        data: { id: draftId, deliverableId, fileName, storageKey, sizeBytes: BigInt(stored.bytes), durationSec: found.durationSec, format: found.format, createdAt: at },
      });
      await tx.draftUsage.create({ data: { creatorId, deliverableId, draftId, seconds: found.durationSec, at } });
      await saveState(tx, deliverableId, start.state);
      await saveItems(tx, deliverableId, start.state.items);
      await tx.draftCheck.update({
        where: { deliverableId },
        data: { draftId, checkStartedAt: at, stage: null, failures: 0, speechJobId: null, fileFailure: Prisma.DbNull, reviewOpenedAt: null },
      });
      await applyEffects(tx, deliverableId, start.effects, { at, links });
      await enqueue(tx, { name: "check_draft", payload: { deliverableId, draftId }, runAt: at });
      return undefined;
    });
    if (refused) return turnedAway(refused);
    return { deliverableId, state: "checking", run: before.row.run };
  }

  return {
    /** Takes the video a creator sends: streamed to storage, and cut off at the size limit as it arrives (DR-FR-02). */
    async send(creatorId: string, deliverableId: string, file: { name?: string; body: ReadableStream<Uint8Array> }): Promise<DraftAccepted | DraftRefused> {
      const taken = await take(creatorId, deliverableId, file.name, (storageKey) => storage.put(storageKey, file.body, { maxBytes: settings.maxBytes }));
      return taken as DraftAccepted | DraftRefused;
    },

    /**
     * Starts the same draft's check again, after it failed on Sponing's side (DR-FR-23). Nothing is
     * uploaded and nothing more is counted: a failed check was never one of the post's checks.
     */
    async retryCheck(creatorId: string, deliverableId: string): Promise<DraftAccepted | RetryRefused> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } } });
      if (!post) return { refused: "not_found" };
      const hold = await holdOf(deliverableId);
      if (hold !== "held") return { refused: hold };
      const at = now();

      return prisma.$transaction(async (tx): Promise<DraftAccepted | RetryRefused> => {
        await lockReview(tx, deliverableId);
        const current = await loadReview(tx, deliverableId, false);
        if (!current || current.row.phase !== "check_failed" || !current.row.draftId) return { refused: "no_failed_check" };
        const start = review(current.state, { type: "draft_started", at }, settings.review);
        if (!start.ok) return { refused: "no_failed_check" };
        await saveState(tx, deliverableId, start.state);
        await tx.draftCheck.update({ where: { deliverableId }, data: { checkStartedAt: at, stage: null, failures: 0, speechJobId: null } });
        await enqueue(tx, { name: "check_draft", payload: { deliverableId, draftId: current.row.draftId }, runAt: at });
        return { deliverableId, state: "checking", run: current.row.run };
      });
    },

    handlers,

    /** Makes sure the daily clear-out is waiting to run. Called when the service starts; calling it again changes nothing. */
    async scheduleExpiry(): Promise<void> {
      await prisma.$transaction(async (tx) => {
        // One at a time, so two services starting together make one job.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${EXPIRE_JOB}))`;
        if ((await tx.job.count({ where: { name: EXPIRE_JOB, status: { in: ["pending", "running"] } } })) > 0) return;
        await enqueue(tx, { name: EXPIRE_JOB, payload: {}, runAt: now() });
      });
    },
  };
}
