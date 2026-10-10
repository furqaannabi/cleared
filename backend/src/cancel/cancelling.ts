/**
 * Cancelling a post (publish to paid spec PT-FR-28 to PT-FR-33; William's cancel spec is the rule).
 * Whether a post with money can be cancelled is the money path's decision, and so is releasing its
 * hold (MP-FR-33, MP-FR-34): this module asks it and passes on its answer (PT-BR-15). What it adds is
 * the note, kept beside the cancel, and the closing of a post that has no money yet because the brand
 * has not agreed. A note is untrusted plain text: kept and shown, never logged, and it decides nothing
 * (PT-BR-10).
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { Money, MoneyRefusal } from "../money/money";
import type { MoneyView } from "../money/view";

type Side = "creator" | "brand";

/** Whether a post can be cancelled now, or why not, and whether a hold attempt is waiting at PayPal (PT-FR-31). */
export type CancelField = { allowed: true; holdAttemptWaiting?: true } | { allowed: false; reason: "go_ahead_running" | "published" | "finished" };

/** Who cancelled a post, when, and their note (PT-FR-32). */
export interface Cancelled {
  by: Side;
  at: string;
  note?: string;
}

export interface CancelInfo {
  cancel: CancelField;
  cancelled?: Cancelled;
}

export type CancelRefused = { ok: false; reason: "not_found" } | { ok: false; reason: "already_cancelled"; by: Side } | { ok: false; reason: MoneyRefusal };

/**
 * Whether a post can be cancelled, read from how its money stands. It mirrors the money path's own
 * rule so that a page can say so before anyone asks; the money path still decides each request.
 * A post with no money yet can be cancelled.
 */
export function cancelField(money: MoneyView | undefined, cancelled: boolean): CancelField {
  if (cancelled) return { allowed: false, reason: "finished" };
  if (!money) return { allowed: true };
  if (["released", "approved_not_paid", "paid", "closed_not_held"].includes(money.stage)) return { allowed: false, reason: "finished" };
  if (money.publishedAt) return { allowed: false, reason: "published" };
  if (money.goAhead.state === "running") return { allowed: false, reason: "go_ahead_running" };
  return money.hold.state === "pending" || money.hold.state === "unknown" ? { allowed: true, holdAttemptWaiting: true } : { allowed: true };
}

/** Who cancelled, from the kept record, or else from what the money path recorded of it. */
function cancelledOf(row: { by: string; at: Date; note: string | null } | undefined, money: MoneyView | undefined): Cancelled | undefined {
  if (row) return { by: row.by as Side, at: row.at.toISOString(), ...(row.note ? { note: row.note } : {}) };
  if (money?.release?.reason === "cancelled" && money.release.by) return { by: money.release.by, at: money.release.at.toISOString() };
  if (money?.closed?.because === "cancelled" && money.closed.by) return { by: money.closed.by, at: money.closed.at.toISOString() };
  return undefined;
}

export type Cancelling = ReturnType<typeof createCancelling>;

export function createCancelling(deps: { prisma: PrismaClient; now: () => Date; money?: Pick<Money, "view" | "cancel"> }) {
  const { prisma, now, money } = deps;

  /** Each post's cancel field and, if it was cancelled, by whom. */
  async function describe(deliverableIds: string[]): Promise<Map<string, CancelInfo>> {
    const rows = new Map((await prisma.postCancel.findMany({ where: { deliverableId: { in: deliverableIds } } })).map((row) => [row.deliverableId, row]));
    const found = new Map<string, CancelInfo>();
    for (const deliverableId of deliverableIds) {
      const view = await money?.view(deliverableId);
      const cancelled = cancelledOf(rows.get(deliverableId), view);
      found.set(deliverableId, { cancel: cancelField(view, !!cancelled), ...(cancelled ? { cancelled } : {}) });
    }
    return found;
  }

  const keep = (db: Prisma.TransactionClient | PrismaClient, deliverableId: string, by: Side, at: Date, note: string | undefined) =>
    db.postCancel.create({ data: { deliverableId, by, at, note: note || null } });

  return {
    describe,

    /**
     * Whether a deal has nothing left to do: every post of it is cancelled, closed without a hold, or
     * released, by whatever path. Its links then open nothing new (PT-FR-33).
     */
    async nothingLeft(dealId: string): Promise<boolean> {
      const posts = await prisma.deliverable.findMany({ where: { dealId }, select: { id: true } });
      if (posts.length === 0) return false;
      const closed = new Set((await prisma.postCancel.findMany({ where: { deliverableId: { in: posts.map((post) => post.id) } }, select: { deliverableId: true } })).map((row) => row.deliverableId));
      for (const post of posts) {
        if (closed.has(post.id)) continue;
        const stage = (await money?.view(post.id))?.stage;
        if (stage !== "released" && stage !== "closed_not_held") return false;
      }
      return true;
    },

    /**
     * Cancels one post of a deal, for a caller already known to be a party to that deal (PT-BR-08).
     * A post with money is cancelled by the money path, which may refuse. One with none yet is closed here.
     */
    async cancel(by: Side, dealId: string, deliverableId: string, note?: string): Promise<{ ok: true } | CancelRefused> {
      if ((await prisma.deliverable.count({ where: { id: deliverableId, dealId } })) !== 1) return { ok: false, reason: "not_found" };
      const earlier = (await describe([deliverableId])).get(deliverableId)?.cancelled;
      if (earlier) return { ok: false, reason: "already_cancelled", by: earlier.by };

      if (!money || !(await money.view(deliverableId))) {
        // No money yet: the brand has not agreed. The post is closed in the deal's own record (PT-FR-30).
        const closed = await prisma.$transaction(async (tx) => {
          // One at a time for a deal, so a post cannot be closed while the brand agrees to it.
          await tx.$queryRaw`SELECT 1 FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`;
          const again = await tx.postCancel.findUnique({ where: { deliverableId } });
          if (again) return { ok: false as const, reason: "already_cancelled" as const, by: again.by as Side };
          // The brand agreed in the meantime: the post has money now, and the money path must be asked.
          if ((await tx.deliverableMoney.count({ where: { deliverableId } })) > 0) return "has_money" as const;
          await keep(tx, deliverableId, by, now(), note);
          return { ok: true as const };
        });
        if (closed !== "has_money") return closed;
      }
      if (!money) return { ok: false, reason: "not_found" };

      const done = await money.cancel(deliverableId, by);
      if (!done.ok) return { ok: false, reason: done.reason };
      // The money path has recorded who and when. The note is kept beside it.
      await keep(prisma, deliverableId, by, now(), note);
      return { ok: true };
    },
  };
}
