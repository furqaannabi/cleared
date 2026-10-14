import { formatMoney } from "@/lib/deliverable/format";
import type { PaymentRow } from "./payment-row";
import { postHref, postWord } from "./post-words";

/** One post that was not paid, as the Not paid list shows it. */
export interface NotPaidRow {
  id: string;
  /** When its hold ended, on the creator's own day: "3 Oct 2026". */
  date: string;
  brand: string;
  post: string;
  /** The deal amount. */
  amount: string;
  why: string;
  href: string;
}

type Because = NonNullable<PaymentRow["releasedBecause"]>;

const WHY: Record<Exclude<Because, "cancelled" | "not_accepted">, string> = {
  deadline: "The deadline passed before you posted",
  day_28: "The hold ran out on day 28",
  fix_window_ended: "Your live post still failed when the fix window ended",
  ruled_not_to_pay: "Sponing decided not to pay",
  hold_not_confirmed: "PayPal couldn’t confirm the hold",
};

/** Why a post was not paid, in a few words (HM-FR-30). */
function why(r: PaymentRow): string {
  if (r.stage === "approved_not_paid") return "Approved, but PayPal didn’t let Sponing collect it";
  const because = r.releasedBecause;
  if (because === "cancelled") return r.cancelledBy === "brand" ? `${r.brandName} cancelled the post` : "You cancelled the post";
  if (because === "not_accepted") return `${r.brandName} didn’t accept the post in time`;
  return because ? WHY[because] : "The hold went back to the brand";
}

/**
 * The posts whose hold went back to the brand or was never collected
 * (`released` or `approved_not_paid`), newest first by when the hold ended,
 * each with why in a few words. Not in the CSV.
 *
 * @param rows - every post that has had a hold
 * @param timeZone - the creator's time zone, for the date
 * @see docs/specs/creator-home-frd.md HM-FR-29, HM-FR-30 (1.8)
 */
export function notPaid(rows: PaymentRow[], timeZone: string): NotPaidRow[] {
  return rows
    .filter((r) => r.stage === "released" || r.stage === "approved_not_paid")
    .sort((a, b) => (b.releasedAt ?? b.heldAt).localeCompare(a.releasedAt ?? a.heldAt))
    .map((r) => ({
      id: r.deliverableId,
      date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(r.releasedAt ?? r.heldAt)),
      brand: r.brandName,
      post: postWord(r.platform),
      amount: formatMoney(r.amountMinor, "USD"),
      why: why(r),
      href: postHref(r),
    }));
}
