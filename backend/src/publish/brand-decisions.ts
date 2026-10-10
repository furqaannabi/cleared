/**
 * The brand's decisions after a post is published (publish to paid spec PT-FR-18, PT-FR-19): confirm
 * or object when the live check could not decide, and accept when it failed on something that cannot
 * be fixed. Each is passed to the money path, which alone decides whether it is allowed and what
 * follows (PT-BR-01). A reason is untrusted plain text: kept and shown, and it decides nothing
 * (PT-BR-10).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { Money, MoneyRefusal } from "../money/money";

export type Decided = { ok: true } | { ok: false; reason: "not_found" | MoneyRefusal };

export type BrandDecisions = ReturnType<typeof createBrandDecisions>;

export function createBrandDecisions(deps: {
  prisma: PrismaClient;
  money?: Pick<Money, "brandConfirmed" | "brandObjected" | "brandAccepted">;
}) {
  const { prisma, money } = deps;

  /** Passes one decision to the money path, for a post of this deal. The caller holds a brand's session for the deal (PT-BR-08). */
  async function pass(dealId: string, deliverableId: string, act: (money: NonNullable<typeof deps.money>) => Promise<{ ok: true } | { ok: false; reason: MoneyRefusal }>): Promise<Decided> {
    if (!money || (await prisma.deliverable.count({ where: { id: deliverableId, dealId } })) !== 1) return { ok: false, reason: "not_found" };
    // Once the money path has the decision it no longer waits on the brand, so the link made for it opens nothing new (PT-FR-20).
    const answer = await act(money);
    return answer.ok ? { ok: true } : answer;
  }

  return {
    /** The brand confirms a live post the check could not decide on (MP-FR-18). */
    confirm: (dealId: string, deliverableId: string) => pass(dealId, deliverableId, (money) => money.brandConfirmed(deliverableId)),
    /** The brand objects, with its reason. A person at Cleared then rules (MP-FR-18, MP-FR-19). */
    object: (dealId: string, deliverableId: string, reason: string) => pass(dealId, deliverableId, (money) => money.brandObjected(deliverableId, reason)),
    /** The brand accepts a live post that failed on something that cannot be fixed (MP-FR-21). */
    accept: (dealId: string, deliverableId: string) => pass(dealId, deliverableId, (money) => money.brandAccepted(deliverableId)),
  };
}
