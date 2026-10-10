/**
 * Deals (deal set-up spec DS-FR-13 to DS-FR-28). Every function takes the creator who is asking, and a
 * deal that is not theirs is treated exactly as one that does not exist (DS-BR-01).
 */
import {
  checkedBy,
  numberLines,
  readBrief,
  type BriefLine,
  type BriefModel,
  type CheckedBy,
  type ItemKind,
  type ProposedItem,
  type ReadQuestion,
} from "../briefs/reader";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { inOrder, noteOf, type DealNote } from "../invites/notes";
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
  /** The brand's notes, once it has asked for changes (DS-FR-38). */
  notes?: DealNote[];
}

/** One line of the deals list. */
export interface DealSummary {
  id: string;
  brandName: string;
  /** One short line of plain text for the list. */
  status: string;
  /** Where setting the deal up stands. Absent once every post is held: the deal has left set-up (DS-FR-46). */
  step?: Step;
  /** The post to open for a deal that has left set-up: the one whose next step is the creator's. */
  openDeliverableId?: string;
  deliverables: { id: string; platform: Platform; state: PostState }[];
}

/** A post's state from the draft check to paid, and whether its next step is the creator's. Read from the posts module. */
type PostState =
  | "no_draft"
  | "checking"
  | "check_failed"
  | "results"
  | "fully_passing"
  | "objected"
  | "approved"
  | "posting"
  | "published"
  | "captured"
  | "paid"
  | "approved_not_paid"
  | "released";
export type DescribePosts = (deliverableIds: string[]) => Promise<Map<string, { state: PostState; needsCreator: boolean }>>;

/**
 * The one-line status of a deal whose posts are all held, and the post to open (DR-FR-28, PT-FR-25).
 * Released posts are left out of it unless every post is released, and finished posts unless every
 * post is finished.
 */
function afterSetUp(brandName: string, posts: { id: string; state: PostState; needsCreator: boolean }[]) {
  const live = posts.filter((post) => post.state !== "released");
  const open = live.filter((post) => post.state !== "paid" && post.state !== "approved_not_paid");
  const states = open.map((post) => post.state);
  const needs = (state: PostState) => open.some((post) => post.state === state && post.needsCreator);
  const status =
    live.length === 0
      ? "Released"
      : open.length === 0
        ? live.some((post) => post.state === "paid")
          ? "Paid"
          : "Approved, not paid"
        : states.includes("objected")
          ? `${brandName} objected`
          : needs("captured")
            ? "Payout needs you"
            : needs("published")
              ? "Fix your live post"
              : states.includes("approved") || states.includes("posting")
                ? "Ready to post"
                : states.includes("published")
                  ? "Live check"
                  : states.every((state) => state === "captured")
                    ? "Captured"
                    : states.every((state) => state === "no_draft")
                      ? "Waiting for your draft"
                      : states.includes("checking") || open.some((post) => post.needsCreator)
                        ? "Draft check"
                        : "Brand review";
  // The post whose next step is the creator's, else the first.
  return { status, openDeliverableId: (live.find((post) => post.needsCreator) ?? posts[0])?.id };
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

/** The money path's stages for a post that has no hold: not held yet, or closed without ever being held. */
const NOT_HELD = ["not_held", "closed_not_held"];

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

/** Why a change to a deal's checklist was refused. */
export type EditRefused =
  | { refused: "not_found" }
  /** The checklist cannot be changed at this point: its brief is not read yet, or the deal has moved on. */
  | { refused: "not_editable" }
  /** The answer picked is not one the question offered. */
  | { refused: "unknown_suggestion" }
  /** The post named is not one of this deal's. */
  | { refused: "unknown_post" }
  /** The checklist cannot be marked ready yet (DS-FR-25). */
  | { refused: "questions_unanswered" | "post_without_items" }
  /** The checklist is not marked ready, so there is nothing to reopen. */
  | { refused: "not_ready" };

/** How a creator answers a question (DS-FR-23). */
export type Answer = { kind: "suggestion"; text: string } | { kind: "own_words"; text: string } | { kind: "left_out" };

const whole = {
  deliverables: { orderBy: { position: "asc" } },
  items: { orderBy: { position: "asc" } },
  questions: { orderBy: { position: "asc" } },
  notes: inOrder,
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
    ...(deal.notes.length ? { notes: deal.notes.map(noteOf) } : {}),
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

  /**
   * Makes one change to a deal's checklist, in a transaction, if the deal is this creator's and its
   * checklist can be edited now. Returns the deal as it then stands.
   */
  async function editChecklist(
    creatorId: string,
    dealId: string,
    change: (tx: Prisma.TransactionClient, deal: Row) => Promise<EditRefused | void>,
  ): Promise<DealDraft | EditRefused> {
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findFirst({ where: { id: dealId, creatorId }, include: whole });
      if (!deal) return { refused: "not_found" };
      if (deal.step !== "checklist" || deal.reading !== "done") return { refused: "not_editable" };
      const refused = await change(tx, deal);
      if (refused) return refused;
      return draftOf(await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: whole }));
    });
  }

  /** Adds a proposed item to every post it applies to, after the items already there. */
  async function addProposed(tx: Prisma.TransactionClient, deal: Row, item: ProposedItem, from: { briefLine: number; questionId: string }) {
    let position = Math.max(-1, ...deal.items.map((existing) => existing.position)) + 1;
    for (const post of deal.deliverables) {
      if (item.appliesTo !== "all" && item.appliesTo !== post.platform) continue;
      await tx.checklistItem.create({
        data: {
          dealId: deal.id,
          deliverableId: post.id,
          name: item.name,
          kind: item.kind,
          exact: item.exact,
          checkedBy: checkedBy(item.kind, item.exact),
          briefLine: from.briefLine,
          questionId: from.questionId,
          position: position++,
        },
      });
    }
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

    /**
     * The creator's own deals, newest first (DS-FR-14). `describe` gives each held post's state at the
     * draft check; without it every post reads as having no draft yet.
     */
    async list(creatorId: string, describe?: DescribePosts): Promise<DealSummary[]> {
      const deals = await prisma.deal.findMany({
        where: { creatorId },
        orderBy: { createdAt: "desc" },
        include: { deliverables: whole.deliverables },
      });
      // Which agreed posts have a hold, read from the stage the money path records. Nothing is decided here.
      const agreedPosts = deals.filter((deal) => deal.step === "agreed").flatMap((deal) => deal.deliverables.map((post) => post.id));
      const withMoney = await prisma.deliverableMoney.findMany({ where: { deliverableId: { in: agreedPosts } }, select: { deliverableId: true, stage: true } });
      const held = new Set(withMoney.filter((money) => !NOT_HELD.includes(money.stage)).map((money) => money.deliverableId));

      const described = (await describe?.(deals.flatMap((deal) => deal.deliverables.map((post) => post.id)).filter((id) => held.has(id)))) ?? new Map();

      return deals.map((deal) => {
        const posts = deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform, state: (described.get(post.id)?.state ?? "no_draft") as PostState }));
        const summary = { id: deal.id, brandName: deal.brandName };
        if (deal.step !== "agreed") {
          // While the brand's changes are being answered the deal says so, whichever page the creator is on.
          const status = deal.revising ? STATUS.changes_requested : STATUS[deal.step as Step];
          return { ...summary, status, step: deal.step as Step, deliverables: posts };
        }
        const heldCount = posts.filter((post) => held.has(post.id)).length;
        if (heldCount < posts.length) {
          return { ...summary, status: `${STATUS.agreed} · ${heldCount} of ${posts.length} held`, step: "agreed", deliverables: posts };
        }
        // Every post is held: set-up is over, and the status follows the draft check (DR-FR-28).
        const next = afterSetUp(deal.brandName, posts.map((post) => ({ ...post, needsCreator: described.get(post.id)?.needsCreator ?? true })));
        return { ...summary, ...next, deliverables: posts };
      });
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

    /**
     * Answers a question (DS-FR-23). A suggested answer adds the item it carries. The creator's own
     * words become the item's name, citing the same line. Left out adds nothing. Answering again
     * replaces the earlier answer and its item. The model is never asked again.
     */
    answerQuestion(creatorId: string, dealId: string, questionId: string, answer: Answer) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        const question = deal.questions.find((candidate) => candidate.id === questionId);
        if (!question) return { refused: "not_found" };
        const suggestions = question.suggestions as unknown as ReadQuestion["suggestions"];

        let item: ProposedItem | undefined;
        if (answer.kind === "suggestion") {
          item = suggestions.find((suggestion) => suggestion.text === answer.text)?.item;
          if (!item) return { refused: "unknown_suggestion" };
        } else if (answer.kind === "own_words") {
          // The kind of item and the posts it applies to are the ones the model proposed for this line.
          const like = suggestions[0]?.item;
          item = { name: answer.text, kind: like?.kind ?? "said", appliesTo: like?.appliesTo ?? "all" };
        }

        await tx.checklistItem.deleteMany({ where: { dealId, questionId } });
        const remaining = { ...deal, items: deal.items.filter((existing) => existing.questionId !== questionId) };
        if (item) await addProposed(tx, remaining, item, { briefLine: question.briefLine, questionId });
        await tx.question.update({
          where: { id: questionId },
          data: { answerKind: answer.kind, answerText: answer.kind === "left_out" ? null : answer.text },
        });
      });
    },

    /** Reopens an answered question, taking away the item its answer made (DS-FR-23). */
    reopenQuestion(creatorId: string, dealId: string, questionId: string) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        if (!deal.questions.some((candidate) => candidate.id === questionId)) return { refused: "not_found" };
        await tx.checklistItem.deleteMany({ where: { dealId, questionId } });
        await tx.question.update({ where: { id: questionId }, data: { answerKind: null, answerText: null } });
      });
    },

    /** Rewords an item. The line it cites stays (DS-FR-24). */
    renameItem(creatorId: string, dealId: string, itemId: string, name: string) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        if (!deal.items.some((item) => item.id === itemId)) return { refused: "not_found" };
        await tx.checklistItem.update({ where: { id: itemId }, data: { name } });
      });
    },

    removeItem(creatorId: string, dealId: string, itemId: string) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        if (!deal.items.some((item) => item.id === itemId)) return { refused: "not_found" };
        await tx.checklistItem.delete({ where: { id: itemId } });
      });
    },

    /** Copies an item to another of the deal's posts, or moves it there (DS-FR-24). */
    placeItem(creatorId: string, dealId: string, itemId: string, deliverableId: string, how: "copy" | "move") {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        const item = deal.items.find((candidate) => candidate.id === itemId);
        if (!item) return { refused: "not_found" };
        if (!deal.deliverables.some((post) => post.id === deliverableId)) return { refused: "unknown_post" };
        if (how === "move") {
          await tx.checklistItem.update({ where: { id: itemId }, data: { deliverableId } });
          return;
        }
        const { id: _id, ...copy } = item;
        const position = Math.max(...deal.items.map((existing) => existing.position)) + 1;
        await tx.checklistItem.create({ data: { ...copy, deliverableId, position } });
      });
    },

    /** Adds an item of the creator's own. It cites no line and is marked as theirs (DS-FR-24, DS-BR-06). */
    addItem(creatorId: string, dealId: string, item: { deliverableId: string; name: string; kind: ItemKind }) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        if (!deal.deliverables.some((post) => post.id === item.deliverableId)) return { refused: "unknown_post" };
        await tx.checklistItem.create({
          data: {
            dealId,
            ...item,
            addedByCreator: true,
            // Decided by code from its kind, like every other item (DS-FR-20).
            checkedBy: checkedBy(item.kind, undefined),
            position: Math.max(-1, ...deal.items.map((existing) => existing.position)) + 1,
          },
        });
      });
    },

    /**
     * Marks the checklist ready, which moves the deal to the invite step (DS-FR-25). Every question
     * must be answered or left out, and every post must have at least one item (DS-BR-08). A creator
     * answering the brand's notes goes back to those changes, not to a new invite (DS-FR-39).
     */
    markReady(creatorId: string, dealId: string) {
      return editChecklist(creatorId, dealId, async (tx, deal) => {
        if (deal.questions.some((question) => question.answerKind === null)) return { refused: "questions_unanswered" };
        const withItems = new Set(deal.items.map((item) => item.deliverableId));
        if (deal.deliverables.some((post) => !withItems.has(post.id))) return { refused: "post_without_items" };
        await tx.deal.update({ where: { id: dealId }, data: { step: deal.revising ? "changes_requested" : "invite" } });
      });
    },

    /**
     * Takes the deal back to the checklist step, so the checklist can be edited again: before a link
     * exists (DS-FR-25), or while answering the brand's notes (DS-FR-39).
     */
    async reopenChecklist(creatorId: string, dealId: string): Promise<DealDraft | EditRefused> {
      return prisma.$transaction(async (tx) => {
        const deal = await tx.deal.findFirst({ where: { id: dealId, creatorId } });
        if (!deal) return { refused: "not_found" };
        if (deal.step !== "invite" && deal.step !== "changes_requested") return { refused: "not_ready" };
        return draftOf(await tx.deal.update({ where: { id: dealId }, data: { step: "checklist" }, include: whole }));
      });
    },

    handlers,
  };
}
