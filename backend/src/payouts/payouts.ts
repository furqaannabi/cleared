/**
 * The creator's side of a payout (publish to paid spec PT-FR-26, PT-FR-27): having one sent again, and
 * what a new PayPal email reaches. It sends nothing and decides nothing: whether a payout can be sent
 * again is the money path's to say, and so is the sending (PT-BR-01). This module only keeps the email
 * a payout goes to in step with the creator's profile, where that is safe
 * (docs/decisions/2026-10-10-a-paypal-email-change-reaches-where-no-payout-has-started.md).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { Money, MoneyRefusal } from "../money/money";

/** A post whose payout is with PayPal, so it keeps the email it went to. For the creator only (PT-BR-09). */
export interface PostKeepingEmail {
  deliverableId: string;
  dealId: string;
  brandName: string;
  email: string;
}

/** A payout PayPal has, or is still being asked to take under the same request id. Its email cannot change under it. */
const WITH_PAYPAL = ["sending", "not_sent", "unclaimed"];
/** Stages with no payout left to send. */
const FINISHED = ["paid", "released", "approved_not_paid", "closed_not_held"];

export type Payouts = ReturnType<typeof createPayouts>;

export function createPayouts(deps: { prisma: PrismaClient; money?: Pick<Money, "creatorView" | "changePayoutEmail" | "payoutRetry"> }) {
  const { prisma, money } = deps;

  return {
    /**
     * The creator saved a new PayPal email (PT-FR-27). It replaces the payout email of every post of
     * theirs whose payout is not with PayPal: none sent yet, one that ended unpaid, or one waiting on a
     * cancellation. A payout that is with PayPal keeps its email, and those posts are returned.
     */
    async emailChanged(creatorId: string, email: string): Promise<PostKeepingEmail[]> {
      if (!money) return [];
      const posts = await prisma.deliverable.findMany({ where: { deal: { creatorId } }, include: { deal: true }, orderBy: [{ deal: { createdAt: "asc" } }, { position: "asc" }] });
      const kept: PostKeepingEmail[] = [];
      for (const post of posts) {
        const view = await money.creatorView(post.id);
        if (!view || FINISHED.includes(view.stage) || view.payoutEmail === email) continue;
        if (view.payout && WITH_PAYPAL.includes(view.payout.status)) kept.push({ deliverableId: post.id, dealId: post.dealId, brandName: post.deal.brandName, email: view.payoutEmail });
        else await money.changePayoutEmail(post.id, email);
      }
      return kept;
    },

    /**
     * "Send it again" (PT-FR-26). The money path decides whether it can be, and its refusal is passed
     * on. When it can, the last payout has finished or is about to be cancelled, so the new one goes
     * to the creator's PayPal email as it now stands (MP-FR-28).
     */
    async sendAgain(creatorId: string, deliverableId: string): Promise<{ sent: true } | { refused: "not_found" } | { refused: "money"; reason: MoneyRefusal }> {
      const post = await prisma.deliverable.findFirst({ where: { id: deliverableId, deal: { creatorId } }, include: { deal: { include: { creator: true } } } });
      if (!post || !money) return { refused: "not_found" };
      const view = await money.creatorView(deliverableId);
      const email = post.deal.creator.paypalEmail;
      if (view?.payout?.canSendAgain && email && email !== view.payoutEmail) await money.changePayoutEmail(deliverableId, email);
      const asked = await money.payoutRetry(deliverableId);
      return asked.ok ? { sent: true } : { refused: "money", reason: asked.reason };
    },
  };
}
