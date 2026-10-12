import { formatMoney } from "@/lib/deliverable/format";
import type { PaymentRow } from "./payment-row";
import { postHref, postWord } from "./post-words";

/** One total: the amount and how many posts it counts. */
export interface MoneyTotal {
  text: string;
  posts: string;
}

/** The money overview: the three totals, and the payouts that are stuck (the first three, and how many more). */
export interface MoneyOverview {
  held: MoneyTotal;
  onItsWay: MoneyTotal;
  paid: MoneyTotal;
  stuck: { lines: { text: string; href: string }[]; more: number };
}

const STUCK_WHY: Partial<Record<NonNullable<PaymentRow["payout"]>["state"], string>> = {
  failed: "the payout didn’t go through.",
  unclaimed: "PayPal is waiting for you to accept it.",
};

const posts = (n: number) => `${n} ${n === 1 ? "post" : "posts"}`;
// Added in cents, never floats (HM-FR-07).
const sum = (rows: PaymentRow[], amount: (r: PaymentRow) => number) => formatMoney(rows.reduce((t, r) => t + amount(r), 0), "USD");

const total = (rows: PaymentRow[]): MoneyTotal => ({ text: sum(rows, (r) => r.receivedMinor ?? 0), posts: posts(rows.length) });

// HM-FR-05 (1.4): what is received comes only once a hold is taken, so held money is the deal amount, before the fee.
const heldTotal = (rows: PaymentRow[]): MoneyTotal => ({ text: sum(rows, (r) => r.amountMinor), posts: `${posts(rows.length)} · before Cleared’s fee` });

/**
 * The money overview from the payment rows: held for you, on its way and
 * paid, each the sum of what the creator receives after Cleared's fee, as the
 * API reports it (the fee is never worked out here).
 *
 * @param rows - every post that has had a hold
 * A failed or unclaimed payout is named, with why, linking to its post.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-05 to HM-FR-07, HM-BR-02, HM-BR-03
 */
export function moneyOverview(rows: PaymentRow[]): MoneyOverview {
  const stuck = rows.flatMap((r) => {
    const why = r.stage === "captured" && r.payout ? STUCK_WHY[r.payout.state] : undefined;
    return why ? [{ text: `${r.brandName} · ${postWord(r.platform)}: ${why}`, href: postHref(r) }] : [];
  });
  return {
    stuck: { lines: stuck.slice(0, 3), more: Math.max(0, stuck.length - 3) },
    held: heldTotal(rows.filter((r) => r.stage === "held")),
    onItsWay: total(rows.filter((r) => r.stage === "captured")),
    paid: total(rows.filter((r) => r.stage === "paid")),
  };
}
