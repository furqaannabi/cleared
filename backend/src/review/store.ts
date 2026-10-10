/**
 * Where a post's draft check and review are kept, and how the rules' state is read from and written to
 * it (draft check and review spec DR-FR-21, DR-FR-25). The rules themselves are in rules.ts and touch
 * no database; this file is the only place their state meets one.
 */
import type { CheckItem, DraftCheck, Prisma, PrismaClient } from "../generated/prisma/client";
import { enqueue } from "../jobs/jobs";
import type { CreatorStatus, ReviewEffect, ReviewItem, ReviewState } from "./rules";

type Db = Prisma.TransactionClient | PrismaClient;

const itemOf = (row: CheckItem): ReviewItem => ({
  id: row.itemId,
  result: row.result as ReviewItem["result"],
  ask: row.ask as ReviewItem["ask"],
  objected: row.objected,
  ...(row.previous ? { previous: row.previous as CreatorStatus } : {}),
  ...(row.whenReplaced ? { whenReplaced: row.whenReplaced as CreatorStatus } : {}),
});

/**
 * A post's review as the rules read it. `released` comes from the money path and is never stored
 * here: whether a hold is still in place is the money path's to say.
 */
export function reviewOf(row: DraftCheck, items: CheckItem[], released: boolean): ReviewState {
  return {
    run: row.run,
    phase: row.phase as ReviewState["phase"],
    items: items.map(itemOf),
    window: row.windowOpenedAt && row.windowEndsAt ? { openedAt: row.windowOpenedAt, endsAt: row.windowEndsAt } : null,
    objectedAt: row.objectedAt,
    approved: row.approvedBy && row.approvedAt ? { by: row.approvedBy as "brand" | "window", at: row.approvedAt } : null,
    shown: row.shown,
    released,
  };
}

/** The post's row, its items in checklist order, and the state the rules read from them. */
export async function loadReview(db: Db, deliverableId: string, released: boolean) {
  const row = await db.draftCheck.findUnique({ where: { deliverableId } });
  if (!row) return undefined;
  const items = await db.checkItem.findMany({ where: { deliverableId }, orderBy: { position: "asc" } });
  return { row, items, state: reviewOf(row, items, released) };
}

/** Holds the post's row until the transaction ends, so two changes to one post happen one after the other. */
export const lockReview = (tx: Prisma.TransactionClient, deliverableId: string) =>
  tx.$queryRaw`SELECT 1 FROM "DraftCheck" WHERE "deliverableId" = ${deliverableId} FOR UPDATE`;

/** Writes what the rules decided about the post as a whole. */
export function saveState(tx: Prisma.TransactionClient, deliverableId: string, state: ReviewState) {
  return tx.draftCheck.update({
    where: { deliverableId },
    data: {
      run: state.run,
      phase: state.phase,
      windowOpenedAt: state.window?.openedAt ?? null,
      windowEndsAt: state.window?.endsAt ?? null,
      objectedAt: state.objectedAt,
      approvedBy: state.approved?.by ?? null,
      approvedAt: state.approved?.at ?? null,
      shown: state.shown,
    },
  });
}

/** Writes what the rules decided about each item it already has a row for: its ask, the brand's answer, and what it was. */
export async function saveItems(tx: Prisma.TransactionClient, deliverableId: string, items: ReviewItem[]) {
  for (const item of items) {
    await tx.checkItem.updateMany({
      where: { deliverableId, itemId: item.id },
      data: { ask: item.ask, objected: item.objected, previous: item.previous ?? null, whenReplaced: item.whenReplaced ?? null },
    });
  }
}

/** Whether the money path has released or closed a post's hold, from the stage it reports. */
export const holdEnded = (stage: string | undefined) => stage === "released" || stage === "closed_not_held";

/**
 * Does what a change asked for, in the transaction that made the change. The window's end is a job
 * written here, so a restart cannot lose it (DR-FR-36). Telling the money path a draft is cleared is
 * done by `clearDraft`, in this same transaction (DR-FR-42); a change that asks for it where none was
 * given is a bug, and fails loudly so no approval is ever recorded without the money path knowing.
 * The brand's review link is made and closed by `links`, where links are set up (DR-FR-44, DR-FR-45).
 */
export async function applyEffects(
  tx: Prisma.TransactionClient,
  deliverableId: string,
  effects: ReviewEffect[],
  actions: {
    at: Date;
    clearDraft?: () => Promise<void>;
    links?: { make(tx: Prisma.TransactionClient, deliverableId: string, at: Date): Promise<void>; close(tx: Prisma.TransactionClient, deliverableId: string, at: Date): Promise<void> };
  },
) {
  for (const effect of effects) {
    switch (effect.type) {
      case "schedule_window_end":
        await enqueue(tx, { name: "review_window_end", payload: { deliverableId }, runAt: effect.at });
        break;
      case "clear_draft":
        if (!actions.clearDraft) throw new Error("A draft was approved where the money path cannot be told");
        await actions.clearDraft();
        break;
      case "make_review_link":
        await actions.links?.make(tx, deliverableId, actions.at);
        break;
      case "end_review_link":
        await actions.links?.close(tx, deliverableId, actions.at);
        break;
    }
  }
}
