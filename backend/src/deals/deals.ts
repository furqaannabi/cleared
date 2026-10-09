/**
 * Deals (deal set-up spec DS-FR-13 to DS-FR-28). Every function takes the creator who is asking, and a
 * deal that is not theirs is treated exactly as one that does not exist (DS-BR-01).
 */
import { numberLines, readBrief, type BriefLine, type BriefModel, type CheckedBy, type ItemKind, type ReadQuestion } from "../briefs/reader";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";

/** The posts a deal can have for now. Reels wait for Instagram to be connected. */
export const PLATFORMS = ["youtube_video", "youtube_short"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Step = "checklist" | "invite" | "waiting_for_brand" | "changes_requested" | "agreed";
export type Reading = "idle" | "reading" | "done" | "failed";

export interface DraftItem {
  id: string;
  deliverableId: string;
  name: string;
  kind: ItemKind;
  /** The brief line it cites. Absent only for an item the creator added (DS-BR-06). */
  briefLine?: number;
  addedByCreator: boolean;
  checkedBy: CheckedBy;
}

export interface DraftQuestion {
  id: string;
  briefLine: number;
  text: string;
  /** The suggested answers, as text. The item each would make stays on the backend. */
  suggestions: string[];
  answer?: { kind: "suggestion" | "own_words" | "left_out"; text?: string };
}

/** A deal as the creator's pages build it, in the shape their client expects. */
export interface DealDraft {
  id: string;
  brandName: string;
  step: Step;
  deliverables: { id: string; platform: Platform }[];
  /** The brief as numbered lines of plain text, once one has been sent. */
  brief?: { lines: BriefLine[] };
  reading: Reading;
  items: DraftItem[];
  questions: DraftQuestion[];
  /** Whether the creator has marked the checklist ready. */
  ready: boolean;
}

/** One line of the deals list. */
export interface DealSummary {
  id: string;
  brandName: string;
  /** One short line of plain text for the list. */
  status: string;
  step: Step;
  deliverables: { id: string; platform: Platform; state: "no_draft" }[];
}

export interface DealSettings {
  /** The shortest and longest brief that is read, in characters (DS-FR-17). */
  briefMin: number;
  briefMax: number;
  /** How many briefs a demo account can have read in total (DS-FR-26). */
  demoReads: number;
  /** How many any other creator can have read in a day (DS-FR-26). */
  creatorReadsPerDay: number;
  /** How many are read in a day across everyone (DS-FR-27). */
  overallReadsPerDay: number;
}

export const defaultDealSettings: DealSettings = {
  briefMin: 40,
  briefMax: 20_000,
  demoReads: 5,
  creatorReadsPerDay: 20,
  overallReadsPerDay: 300,
};

/** The deals list's line for each step of setting a deal up. */
const STATUS: Record<Step, string> = {
  checklist: "Checklist",
  invite: "Invite",
  waiting_for_brand: "Waiting for brand",
  changes_requested: "Changes asked",
  agreed: "Agreed",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChangeRefused =
  | { refused: "not_found" }
  /** The posts can no longer change: the brief has been sent (DS-FR-16). */
  | { refused: "reading_started" }
  /** A post was sent with an id that is not one of this deal's. `index` is its place in what was sent. */
  | { refused: "unknown_post"; index: number };

export type BriefRefused =
  | { refused: "not_found" }
  /** The brief is being read or has been read. It is sent once; a failed read can be sent again. */
  | { refused: "reading_started" }
  | { refused: "too_short" | "too_long" }
  /** A limit on reading was reached (DS-FR-28). `resetsAt` is when a daily one lifts. */
  | { refused: "read_limit"; limit: "demo" | "creator" | "overall"; resetsAt?: Date };

const whole = {
  deliverables: { orderBy: { position: "asc" } },
  items: { orderBy: { position: "asc" } },
  questions: { orderBy: { position: "asc" } },
} as const;

type Row = Prisma.DealGetPayload<{ include: typeof whole }>;

export type Deals = ReturnType<typeof createDeals>;

export function createDeals(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** The model that reads briefs. Without it every read fails. */
  model?: BriefModel;
  settings?: DealSettings;
}) {
  const { prisma, now, model } = deps;
  const settings = deps.settings ?? defaultDealSettings;

  const find = (creatorId: string, dealId: string) =>
    prisma.deal.findFirst({ where: { id: dealId, creatorId }, include: whole });

  const draftOf = (deal: Row): DealDraft => ({
    id: deal.id,
    brandName: deal.brandName,
    step: deal.step as Step,
    deliverables: deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform })),
    ...(deal.briefLines ? { brief: { lines: deal.briefLines as unknown as BriefLine[] } } : {}),
    reading: deal.reading as Reading,
    items: deal.items.map((item) => ({
      id: item.id,
      deliverableId: item.deliverableId,
      name: item.name,
      kind: item.kind as ItemKind,
      ...(item.briefLine === null ? {} : { briefLine: item.briefLine }),
      addedByCreator: item.addedByCreator,
      checkedBy: item.checkedBy as CheckedBy,
    })),
    questions: deal.questions.map((question) => ({
      id: question.id,
      briefLine: question.briefLine,
      text: question.text,
      suggestions: (question.suggestions as unknown as ReadQuestion["suggestions"]).map((suggestion) => suggestion.text),
      ...(question.answerKind
        ? { answer: { kind: question.answerKind as "suggestion" | "own_words" | "left_out", ...(question.answerText ? { text: question.answerText } : {}) } }
        : {}),
    })),
    ready: deal.step !== "checklist",
  });

  /**
   * Whether one more brief may be read for this creator (DS-FR-26, DS-FR-27). It is asked inside the
   * transaction that records the read, so the count it sees includes every read recorded before it.
   */
  async function limitReached(
    tx: Prisma.TransactionClient,
    creator: { id: string; demo: boolean },
    at: Date,
  ): Promise<Extract<BriefRefused, { refused: "read_limit" }> | undefined> {
    const dayAgo = new Date(at.getTime() - DAY_MS);
    /** When the oldest read still counted leaves the day, which is when one more is allowed. */
    const resets = async (where: Prisma.BriefReadWhereInput) => {
      const oldest = await tx.briefRead.findFirst({ where, orderBy: { at: "asc" } });
      return oldest ? new Date(oldest.at.getTime() + DAY_MS) : undefined;
    };

    if (creator.demo) {
      if ((await tx.briefRead.count({ where: { creatorId: creator.id } })) >= settings.demoReads) {
        return { refused: "read_limit", limit: "demo" };
      }
    } else {
      const mine = { creatorId: creator.id, at: { gt: dayAgo } };
      if ((await tx.briefRead.count({ where: mine })) >= settings.creatorReadsPerDay) {
        return { refused: "read_limit", limit: "creator", resetsAt: await resets(mine) };
      }
    }
    const everyones = { at: { gt: dayAgo } };
    if ((await tx.briefRead.count({ where: everyones })) >= settings.overallReadsPerDay) {
      return { refused: "read_limit", limit: "overall", resetsAt: await resets(everyones) };
    }
    return undefined;
  }

  /** The jobs this module schedules. */
  const handlers = {
    /** Reads a deal's brief with the model, and saves the items and questions together (DS-FR-18). */
    async read_brief(payload) {
      const { dealId, readId } = payload as { dealId?: unknown; readId?: unknown };
      if (typeof dealId !== "string" || typeof readId !== "string") throw new Error("A read_brief job is missing its ids");
      const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: whole });
      if (!deal || deal.reading !== "reading" || !deal.briefLines) {
        // Nothing to read any more. The model was never called, so this read does not count (DS-BR-16).
        await prisma.briefRead.deleteMany({ where: { id: readId, modelCalled: false } });
        return;
      }
      const lines = deal.briefLines as unknown as BriefLine[];
      const posts = deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform }));

      let read: Awaited<ReturnType<typeof readBrief>>;
      try {
        if (!model) throw new Error("No model is set up to read briefs");
        await prisma.briefRead.updateMany({ where: { id: readId }, data: { modelCalled: true } });
        read = await readBrief({ model, lines, posts });
      } catch {
        // Whatever went wrong, the creator is told the brief could not be read, and can try again.
        read = { ok: false, reason: "unavailable" };
      }

      await prisma.$transaction(async (tx) => {
        // The deal may have changed while the model was reading. Only a deal still being read is touched.
        const current = await tx.deal.findUnique({ where: { id: dealId }, select: { reading: true } });
        if (current?.reading !== "reading") return;
        if (!read.ok) {
          await tx.deal.update({ where: { id: dealId }, data: { reading: "failed" } });
          return;
        }
        await tx.checklistItem.createMany({
          data: read.items.map((item, position) => ({
            dealId,
            deliverableId: item.deliverableId,
            name: item.name,
            kind: item.kind,
            briefLine: item.briefLine,
            exact: item.exact,
            checkedBy: item.checkedBy,
            position,
          })),
        });
        await tx.question.createMany({
          data: read.questions.map((question, position) => ({
            dealId,
            briefLine: question.briefLine,
            text: question.text,
            suggestions: question.suggestions as unknown as Prisma.InputJsonValue,
            position,
          })),
        });
        await tx.deal.update({ where: { id: dealId }, data: { reading: "done" } });
      });
    },
  } satisfies JobHandlers;

  return {
    /** Starts a deal at the checklist step (DS-FR-13). */
    async start(creatorId: string, input: { brandName: string; platforms: Platform[] }): Promise<DealDraft> {
      const deal = await prisma.deal.create({
        data: {
          creatorId,
          brandName: input.brandName,
          createdAt: now(),
          deliverables: { create: input.platforms.map((platform, position) => ({ platform, position })) },
        },
        include: whole,
      });
      return draftOf(deal);
    },

    /** The creator's own deals, newest first (DS-FR-14). */
    async list(creatorId: string): Promise<DealSummary[]> {
      const deals = await prisma.deal.findMany({
        where: { creatorId },
        orderBy: { createdAt: "desc" },
        include: { deliverables: whole.deliverables },
      });
      return deals.map((deal) => ({
        id: deal.id,
        brandName: deal.brandName,
        status: STATUS[deal.step as Step],
        step: deal.step as Step,
        deliverables: deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform, state: "no_draft" })),
      }));
    },

    /** One deal, if it is this creator's (DS-FR-15). */
    async draft(creatorId: string, dealId: string): Promise<DealDraft | undefined> {
      const deal = await find(creatorId, dealId);
      return deal ? draftOf(deal) : undefined;
    },

    /**
     * Changes the brand's name and the posts (DS-FR-16). A post sent with its id keeps it; one sent
     * without is new; one left out is removed. Allowed only until the brief has been sent.
     */
    async change(
      creatorId: string,
      dealId: string,
      input: { brandName: string; posts: { id?: string; platform: Platform }[] },
    ): Promise<DealDraft | ChangeRefused> {
      return prisma.$transaction(async (tx) => {
        const deal = await tx.deal.findFirst({ where: { id: dealId, creatorId }, include: whole });
        if (!deal) return { refused: "not_found" };
        const settled = deal.step === "checklist" && (deal.reading === "idle" || deal.reading === "failed");
        if (!settled) return { refused: "reading_started" };

        const own = new Set(deal.deliverables.map((post) => post.id));
        const unknown = input.posts.findIndex((post) => post.id !== undefined && !own.has(post.id));
        if (unknown !== -1) return { refused: "unknown_post", index: unknown };

        const kept = input.posts.flatMap((post) => (post.id ? [post.id] : []));
        await tx.deliverable.deleteMany({ where: { dealId, id: { notIn: kept } } });
        for (const [position, post] of input.posts.entries()) {
          if (post.id) await tx.deliverable.update({ where: { id: post.id }, data: { platform: post.platform, position } });
          else await tx.deliverable.create({ data: { dealId, platform: post.platform, position } });
        }
        const changed = await tx.deal.update({ where: { id: dealId }, data: { brandName: input.brandName }, include: whole });
        return draftOf(changed);
      });
    },

    /**
     * Stores the brief as numbered lines and starts reading it as a job (DS-FR-17). The job and the
     * count towards the limits are written with it, or not at all.
     */
    async sendBrief(creatorId: string, dealId: string, text: string): Promise<DealDraft | BriefRefused> {
      const brief = text.trim();
      if (brief.length < settings.briefMin) return { refused: "too_short" };
      if (brief.length > settings.briefMax) return { refused: "too_long" };
      const lines = numberLines(brief);
      const at = now();

      return prisma.$transaction(async (tx) => {
        const deal = await tx.deal.findFirst({ where: { id: dealId, creatorId }, include: { creator: true } });
        if (!deal) return { refused: "not_found" };
        const sendable = deal.step === "checklist" && (deal.reading === "idle" || deal.reading === "failed");
        if (!sendable) return { refused: "reading_started" };
        const limit = await limitReached(tx, deal.creator, at);
        if (limit) return limit;

        // A read that failed left nothing behind, but a second send starts clean either way.
        await tx.checklistItem.deleteMany({ where: { dealId } });
        await tx.question.deleteMany({ where: { dealId } });
        const read = await tx.briefRead.create({ data: { creatorId, at } });
        await enqueue(tx, { name: "read_brief", payload: { dealId, readId: read.id }, runAt: at });
        const reading = await tx.deal.update({
          where: { id: dealId },
          data: { reading: "reading", briefLines: lines as unknown as Prisma.InputJsonValue },
          include: whole,
        });
        return draftOf(reading);
      });
    },

    handlers,
  };
}
