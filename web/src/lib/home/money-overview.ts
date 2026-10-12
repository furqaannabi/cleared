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

const total = (rows: PaymentRow[]): MoneyTotal => ({
  // Added in cents, never floats (HM-FR-07).
  text: formatMoney(rows.reduce((sum, r) => sum + r.receivedMinor, 0), "USD"),
  posts: `${rows.length} ${rows.length === 1 ? "post" : "posts"}`,
});

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
    held: total(rows.filter((r) => r.stage === "held")),
    onItsWay: total(rows.filter((r) => r.stage === "captured")),
    paid: total(rows.filter((r) => r.stage === "paid")),
  };
}
