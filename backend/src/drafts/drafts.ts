/**
 * Drafts: the video a creator sends for a held post before publishing, and the limits on sending them
 * (draft check and review spec DR-FR-01 to DR-FR-09). Whether a draft may be sent at all is decided by
 * the review rules; this module applies them, stores the file and starts its check as a job.
 */
import { Prisma, type DraftCheck, type PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { Media } from "../media/port";
import type { Money } from "../money/money";
import { review, type ReviewItem, type ReviewState } from "../review/rules";
import type { Storage } from "../storage/port";

export interface DraftSettings {
  /** The largest file taken, in bytes, and the longest video, in seconds (DR-FR-02, DR-FR-03). */
  maxBytes: number;
  maxSeconds: number;
  /** How many times one post can be checked (DR-FR-06). */
  maxChecks: number;
  /** How much video is checked in a day across everyone, in seconds (DR-FR-07). */
  dailySeconds: number;
  /** How many drafts a demo account can have checked in total, and how long each may be (DR-FR-08). */
  demoDrafts: number;
  demoMaxSeconds: number;
  /** How long an address that reads a draft works for (DR-BR-12). */
  addressSeconds: number;
}

export const defaultDraftSettings: DraftSettings = {
  maxBytes: 1024 ** 3,
  maxSeconds: 15 * 60,
  maxChecks: 10,
  dailySeconds: 300 * 60,
  demoDrafts: 3,
  demoMaxSeconds: 3 * 60,
  addressSeconds: 15 * 60,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_NAME_MAX = 200;

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
  | { refused: "limit"; limit: "post" | "demo" | "overall"; resetsAt?: Date }
  | { refused: "too_large" }
  | { refused: "file"; failure: FileFailure };

export interface DraftAccepted {
  deliverableId: string;
  state: "checking";
  /** How many runs have finished so far. The one just started is not one yet. */
  run: number;
}

/**
 * A post's review as the rules read it, from its row. `released` comes from the money path, never from
 * here. The items arrive with the check itself; until a run has finished there are none.
 */
export function reviewOf(row: DraftCheck, released: boolean, items: ReviewItem[] = []): ReviewState {
  return {
    run: row.run,
    phase: row.phase as ReviewState["phase"],
    items,
    window: row.windowOpenedAt && row.windowEndsAt ? { openedAt: row.windowOpenedAt, endsAt: row.windowEndsAt } : null,
    objectedAt: row.objectedAt,
    approved: row.approvedBy && row.approvedAt ? { by: row.approvedBy as "brand" | "window", at: row.approvedAt } : null,
    shown: row.shown,
    released,
  };
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
  /** The money path, read to know whether a post's hold is in place. Without it no post is held. */
  money?: Pick<Money, "view">;
  settings?: DraftSettings;
}) {
  const { prisma, now, storage, media, money } = deps;
  const settings = deps.settings ?? defaultDraftSettings;

  /** Whether the post's hold is in place, as the money path has it. */
  async function holdOf(deliverableId: string): Promise<"held" | "not_held" | "released"> {
    const stage = (await money?.view(deliverableId))?.stage;
    if (stage === "held") return "held";
    return stage === undefined || stage === "not_held" ? "not_held" : "released";
  }

  /**
   * Whether one more draft may be checked: for this post, for a demo account, and across everyone
   * today (DR-FR-06 to DR-FR-08). `seconds` is the new draft's length once it is known; before the
   * file has been read it is zero, which asks only whether the day's total is already used up.
   */
  async function limitReached(
    db: Prisma.TransactionClient | PrismaClient,
    who: { creatorId: string; demo: boolean; run: number },
    seconds: number,
    at: Date,
  ): Promise<Extract<DraftRefused, { refused: "limit" }> | undefined> {
    if (who.run >= settings.maxChecks) return { refused: "limit", limit: "post" };
    if (who.demo && (await db.draftUsage.count({ where: { creatorId: who.creatorId } })) >= settings.demoDrafts) {
      return { refused: "limit", limit: "demo" };
    }
    const today = { at: { gt: new Date(at.getTime() - DAY_MS) } };
    const used = (await db.draftUsage.aggregate({ where: today, _sum: { seconds: true } }))._sum.seconds ?? 0;
    if (seconds === 0 ? used >= settings.dailySeconds : used + seconds > settings.dailySeconds) {
      // One more is allowed when the oldest draft still counted leaves the day.
      const oldest = await db.draftUsage.findFirst({ where: today, orderBy: { at: "asc" } });
      return { refused: "limit", limit: "overall", resetsAt: oldest ? new Date(oldest.at.getTime() + DAY_MS) : undefined };
    }
    return undefined;
  }

  /** The jobs this module schedules. The check itself arrives with the next part of the spec. */
  const handlers = {} satisfies JobHandlers;

  return {
    /**
     * Takes a draft for a held post (DR-FR-01 to DR-FR-05). In order: who is asking and whether the
     * post can take a draft, the limits that need no file, the file streamed to storage and cut off
     * at the size limit, the file read to see what it really is, and then, in one transaction, the
     * draft recorded and its check started as a job. A file refused at any point is deleted.
     */
    async send(creatorId: string, deliverableId: string, file: { name?: string; body: ReadableStream<Uint8Array> }): Promise<DraftAccepted | DraftRefused> {
      const post = await prisma.deliverable.findFirst({
        where: { id: deliverableId, deal: { creatorId } },
        include: { deal: { include: { creator: { select: { demo: true } } } } },
      });
      if (!post) return { refused: "not_found" };
      const hold = await holdOf(deliverableId);
      if (hold !== "held") return { refused: hold };

      const at = now();
      const fileName = plainName(file.name);
      const demo = post.deal.creator.demo;
      const row = await prisma.draftCheck.upsert({ where: { deliverableId }, create: { deliverableId }, update: {} });
      const allowed = review(reviewOf(row, false), { type: "draft_started", at });
      if (!allowed.ok) return { refused: allowed.reason as "check_running" | "approved" };
      const early = await limitReached(prisma, { creatorId, demo, run: row.run }, 0, at);
      if (early) return early;

      const draftId = crypto.randomUUID();
      // The key is the service's own. Nothing of the file's name goes into it.
      const storageKey = `drafts/${deliverableId}/${draftId}`;
      const stored = await storage.put(storageKey, file.body, { maxBytes: settings.maxBytes });
      if (stored === "too_large") return { refused: "too_large" };

      /** Deletes the file just stored and answers with why it was not taken. */
      const turnedAway = async <Refusal extends DraftRefused>(refusal: Refusal): Promise<Refusal> => {
        await storage.delete(storageKey);
        return refusal;
      };

      // What the file is comes from reading it, never from its name or what the browser said (DR-FR-03).
      const lengthCapSec = demo ? settings.demoMaxSeconds : settings.maxSeconds;
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
        await tx.$queryRaw`SELECT 1 FROM "DraftCheck" WHERE "deliverableId" = ${deliverableId} FOR UPDATE`;
        const current = await tx.draftCheck.findUniqueOrThrow({ where: { deliverableId } });
        const start = review(reviewOf(current, false), { type: "draft_started", at });
        if (!start.ok) return { refused: start.reason as "check_running" | "approved" };
        const limit = await limitReached(tx, { creatorId, demo, run: current.run }, found.durationSec, at);
        if (limit) return limit;

        await tx.draft.create({
          data: { id: draftId, deliverableId, fileName, storageKey, sizeBytes: BigInt(stored.bytes), durationSec: found.durationSec, createdAt: at },
        });
        await tx.draftUsage.create({ data: { creatorId, deliverableId, draftId, seconds: found.durationSec, at } });
        await tx.draftCheck.update({
          where: { deliverableId },
          data: {
            phase: start.state.phase,
            draftId,
            checkStartedAt: at,
            // A new draft ends the window and what the brand had done on the run before (DR-FR-05).
            windowOpenedAt: null,
            windowEndsAt: null,
            objectedAt: null,
            shown: start.state.shown,
            fileFailure: Prisma.DbNull,
          },
        });
        await enqueue(tx, { name: "check_draft", payload: { deliverableId, draftId }, runAt: at });
        return undefined;
      });
      if (refused) return turnedAway(refused);
      return { deliverableId, state: "checking", run: row.run };
    },

    handlers,
  };
}
