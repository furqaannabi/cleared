/**
 * What the two sides do with a checked draft (draft check and review spec DR-FR-30 to DR-FR-43): the
 * creator asks the brand about an unsure item, the brand answers, objects or approves, and the review
 * window's timer approves in silence. Each is one event given to the rules (rules.ts), which decide;
 * this module finds the post, checks who is asking, and writes down what the rules decided, with what
 * follows from it, in one transaction.
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { JobHandlers } from "../jobs/jobs";
import type { Money } from "../money/money";
import { defaultReviewSettings, review, type ReviewEvent, type ReviewRefusal, type ReviewSettings } from "./rules";
import { applyEffects, holdEnded, loadReview, lockReview, saveItems, saveState } from "./store";

export type Acted = { ok: true } | { ok: false; reason: ReviewRefusal | "not_found" };

export type Review = ReturnType<typeof createReview>;

export function createReview(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** The money path: read for whether the hold stands, and told when a draft is cleared. */
  money?: Pick<Money, "view" | "draftClearedIn">;
  settings?: ReviewSettings;
}) {
  const { prisma, now, money } = deps;
  const settings = deps.settings ?? defaultReviewSettings;

  /**
   * Gives one event to the rules for a post and records the outcome. `alongside` writes what belongs
   * with the change but is not the rules' business, such as a note's text. A draft the rules approve
   * is recorded as cleared with the money path in this same transaction, so it is all or nothing (DR-FR-42).
   */
  async function act(deliverableId: string, event: ReviewEvent, alongside?: (tx: Prisma.TransactionClient) => Promise<void>): Promise<Acted> {
    const released = holdEnded((await money?.view(deliverableId))?.stage);
    return prisma.$transaction(async (tx): Promise<Acted> => {
      await lockReview(tx, deliverableId);
      const loaded = await loadReview(tx, deliverableId, released);
      // No draft was ever sent for this post, so there is nothing to ask about, answer or approve.
      if (!loaded) return { ok: false, reason: event.type === "approve" ? "nothing_to_approve" : event.type === "object" ? "window_not_open" : "no_results" };
      const result = review(loaded.state, event, settings);
      if (!result.ok) return { ok: false, reason: result.reason === "unknown_item" ? "not_found" : result.reason };
      if (result.state === loaded.state) return { ok: true };

      await saveState(tx, deliverableId, result.state);
      await saveItems(tx, deliverableId, result.state.items);
      await alongside?.(tx);
      await applyEffects(tx, deliverableId, result.effects, {
        clearDraft: async () => {
          if (!money) throw new Error("A draft was approved with no money path to tell");
          await money.draftClearedIn(tx, deliverableId, event.at);
        },
      });
      return { ok: true };
    });
  }

  /** Whether the post is one of this creator's. One that is not is treated as one that does not exist (DR-BR-11). */
  const isCreators = async (creatorId: string, deliverableId: string) =>
    (await prisma.deliverable.count({ where: { id: deliverableId, deal: { creatorId } } })) === 1;

  /** Whether the post is in the deal the brand's session is for. */
  const isInDeal = async (dealId: string, deliverableId: string) => (await prisma.deliverable.count({ where: { id: deliverableId, dealId } })) === 1;

  const item = (deliverableId: string, itemId: string) => ({ where: { deliverableId, itemId } });

  /** The jobs this module schedules. */
  const handlers = {
    /**
     * The review window's end (DR-FR-40). The rules decide whether silence approves: only a window
     * still open, on a run still the latest and still fully passing (DR-BR-02). Run twice, or run for a
     * window that has since ended, it changes nothing.
     */
    async review_window_end(payload, { now: at }) {
      const deliverableId = (payload as { deliverableId?: unknown } | null)?.deliverableId;
      if (typeof deliverableId !== "string") throw new Error("A review_window_end job is missing its deliverableId");
      await act(deliverableId, { type: "window_due", at });
    },
  } satisfies JobHandlers;

  return {
    /** The creator asks the brand to accept an unsure item (DR-FR-30). */
    async ask(creatorId: string, deliverableId: string, itemId: string): Promise<Acted> {
      if (!(await isCreators(creatorId, deliverableId))) return { ok: false, reason: "not_found" };
      const at = now();
      return act(deliverableId, { type: "ask", itemId, at }, async (tx) => void (await tx.checkItem.updateMany({ ...item(deliverableId, itemId), data: { askedAt: at } })));
    },

    /** The creator withdraws an ask the brand has not answered (DR-FR-31). */
    async withdraw(creatorId: string, deliverableId: string, itemId: string): Promise<Acted> {
      if (!(await isCreators(creatorId, deliverableId))) return { ok: false, reason: "not_found" };
      return act(deliverableId, { type: "withdraw", itemId, at: now() }, async (tx) => void (await tx.checkItem.updateMany({ ...item(deliverableId, itemId), data: { askedAt: null } })));
    },

    /** The brand accepts an item it was asked about (DR-FR-32). */
    async accept(dealId: string, deliverableId: string, itemId: string): Promise<Acted> {
      if (!(await isInDeal(dealId, deliverableId))) return { ok: false, reason: "not_found" };
      return act(deliverableId, { type: "accept", itemId, at: now() });
    },

    /** The brand asks for an item it was asked about to be fixed instead, with an optional note (DR-FR-33). */
    async askFix(dealId: string, deliverableId: string, itemId: string, note?: string): Promise<Acted> {
      if (!(await isInDeal(dealId, deliverableId))) return { ok: false, reason: "not_found" };
      // The note is untrusted plain text: kept and shown as text, and it decides nothing (DR-BR-09).
      return act(deliverableId, { type: "ask_fix", itemId, at: now() }, async (tx) => void (await tx.checkItem.updateMany({ ...item(deliverableId, itemId), data: { brandNote: note || null } })));
    },

    /** The brand approves the draft: in the window, or after it objected (DR-FR-37). */
    async approve(dealId: string, deliverableId: string): Promise<Acted> {
      if (!(await isInDeal(dealId, deliverableId))) return { ok: false, reason: "not_found" };
      return act(deliverableId, { type: "approve", at: now() });
    },

    /** The brand objects to passed items, each with a note, once per draft (DR-FR-38). */
    async object(dealId: string, deliverableId: string, objections: { itemId: string; note: string }[]): Promise<Acted> {
      if (!(await isInDeal(dealId, deliverableId))) return { ok: false, reason: "not_found" };
      return act(deliverableId, { type: "object", itemIds: objections.map((objection) => objection.itemId), at: now() }, async (tx) => {
        for (const objection of objections) await tx.checkItem.updateMany({ ...item(deliverableId, objection.itemId), data: { brandNote: objection.note } });
      });
    },

    handlers,
  };
}
