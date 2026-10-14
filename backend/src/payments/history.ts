/**
 * The creator's payment history (account and history spec AH-FR-05 to AH-FR-09): one row for every
 * post of theirs that has ever had a hold. Every amount, stage and date is read from the money path's
 * own view and decided nowhere else (AH-BR-01). It is built from the plain view, which holds no
 * PayPal email (AH-FR-08), and it is the creator's alone: a brand is never shown it (AH-BR-05).
 */
import type { Platform } from "../deals/platforms";
import type { PrismaClient } from "../generated/prisma/client";
import type { Money } from "../money/money";
import type { MoneyView } from "../money/view";

export interface PaymentRow {
  dealId: string;
  deliverableId: string;
  /** The brand's name as the creator typed it: untrusted plain text. */
  brandName: string;
  platform: Platform;
  /** Whole minor units, as every amount here is (AH-BR-07). */
  amountMinor: number;
  /** Sponing's fee and what the creator receives, once the hold is taken: fixed by the money path at capture (MP-FR-27). */
  feeMinor?: number;
  receivedMinor?: number;
  currency: "USD";
  stage: "held" | "captured" | "paid" | "released" | "approved_not_paid";
  /** The payout, once the hold is taken. Its state is as on the creator's post. */
  payout?: { state: "sending" | "cancelling" | "delayed" | "unclaimed" | "failed" | "paid"; reference?: string; at?: string };
  holdReference: string;
  heldAt: string;
  /** The moment the creator must post by, as on the creator's post. */
  deadline: string;
  publishedAt?: string;
  paidAt?: string;
  /** Whether the first draft check that finished passed every item. Absent while none has (AH-FR-09). */
  firstCheckPassed?: boolean;
}

/** The post a row is about, as much of it as the row carries. */
export interface PaidPost {
  dealId: string;
  deliverableId: string;
  brandName: string;
  platform: Platform;
}

/**
 * A decimal amount with two places as whole minor units: "1200.00" is 120000. The digits are moved,
 * not multiplied, so no fraction is ever worked out (AH-BR-07).
 */
function minor(amount: string): number {
  if (!/^\d+\.\d{2}$/.test(amount)) throw new Error("An amount from the money path is not in whole cents");
  return Number(amount.replace(".", ""));
}

/** One post's row, from the money path's view of it. Nothing if the post never had a hold (AH-FR-05). */
export function paymentRow(post: PaidPost, money: MoneyView, firstCheckPassed?: boolean | null): PaymentRow | undefined {
  const { hold, amounts, payout } = money;
  if (hold.state !== "held" || money.stage === "not_held" || money.stage === "closed_not_held") return undefined;
  const paidAt = payout?.status === "paid" ? payout.at : undefined;
  return {
    dealId: post.dealId,
    deliverableId: post.deliverableId,
    brandName: post.brandName,
    platform: post.platform,
    amountMinor: minor(amounts.amount),
    ...(amounts.fee === null ? {} : { feeMinor: minor(amounts.fee) }),
    ...(amounts.payout === null ? {} : { receivedMinor: minor(amounts.payout) }),
    currency: amounts.currency,
    stage: money.stage,
    ...(payout
      ? {
          payout: {
            state: payout.status === "not_sent" ? ("delayed" as const) : payout.status,
            ...(payout.reference ? { reference: payout.reference } : {}),
            ...(payout.at ? { at: payout.at.toISOString() } : {}),
          },
        }
      : {}),
    holdReference: hold.reference,
    heldAt: hold.heldAt.toISOString(),
    deadline: hold.deadlineAt.toISOString(),
    ...(money.publishedAt ? { publishedAt: money.publishedAt.toISOString() } : {}),
    ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
    ...(typeof firstCheckPassed === "boolean" ? { firstCheckPassed } : {}),
  };
}

export type PaymentHistory = ReturnType<typeof createPaymentHistory>;

export function createPaymentHistory(deps: { prisma: PrismaClient; money?: Pick<Money, "view"> }) {
  const { prisma, money } = deps;

  return {
    /** Every post of this creator's that has ever had a hold, newest hold first (AH-FR-05). */
    async of(creatorId: string): Promise<PaymentRow[]> {
      if (!money) return [];
      const posts = await prisma.deliverable.findMany({ where: { deal: { creatorId } }, include: { deal: { select: { brandName: true } } } });
      const checks = new Map(
        (await prisma.draftCheck.findMany({ where: { deliverableId: { in: posts.map((post) => post.id) } }, select: { deliverableId: true, firstCheckPassed: true } })).map((check) => [check.deliverableId, check.firstCheckPassed]),
      );
      const rows: PaymentRow[] = [];
      for (const post of posts) {
        const view = await money.view(post.id);
        const row = view && paymentRow({ dealId: post.dealId, deliverableId: post.id, brandName: post.deal.brandName, platform: post.platform as Platform }, view, checks.get(post.id));
        if (row) rows.push(row);
      }
      return rows.sort((first, second) => second.heldAt.localeCompare(first.heldAt));
    },
  };
}
