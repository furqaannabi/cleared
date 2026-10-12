/**
 * When a post ended, for how long its drafts are kept (account and history spec AH-FR-23;
 * docs/decisions/2026-10-12-how-long-cleared-keeps-things.md). A post's drafts, and everything read
 * from them, are deleted 30 days after it is paid, released, closed, or approved and not paid. The
 * moment is the money path's own; nothing is decided here (AH-BR-01).
 */
import type { MoneyView } from "../money/view";

/** The moment a post ended, or nothing while it has not. A stage with no moment recorded for it has not ended: nothing is deleted on a guess. */
export function endedAt(money: MoneyView): Date | undefined {
  switch (money.stage) {
    case "paid":
      return money.payout?.status === "paid" ? money.payout.at : undefined;
    case "released":
    case "approved_not_paid":
      return money.release?.at;
    case "closed_not_held":
      return money.closed?.at;
    default:
      return undefined;
  }
}
