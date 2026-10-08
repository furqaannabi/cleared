import { formatAmount } from "@/lib/invite/amount";
import type { Hold } from "./types";

/** What one post's hold line says, and whether its Approve button is on. */
export interface HoldLine {
  held: boolean;
  message: string | null;
  /** The last try failed in a way the brand should act on. */
  problem: boolean;
  canApprove: boolean;
}

/** "23 Oct": a hold's fixed deadline, as a shared date (no time of day). */
function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * One post's hold, as the API reports it. Only the API's `held` reads as
 * held, and the button is off while PayPal hasn't answered, so the brand is
 * never asked to approve twice.
 *
 * @param hold - the post's hold state from the API
 * @param context.creator - the creator's name
 * @param context.amount - the post's amount, a two-place decimal string
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17, CH-FR-18, CH-BR-05
 */
export function holdLine(hold: Hold, { creator, amount }: { creator: string; amount: string }): HoldLine {
  switch (hold.state) {
    case "held": {
      const ref = hold.reference ? ` · PayPal ref ${hold.reference}` : "";
      const by = hold.deadline ? ` · ${creator} posts by ${shortDate(hold.deadline)}` : "";
      return { held: true, message: `Held · ${formatAmount(amount)}${ref}${by}`, problem: false, canApprove: false };
    }
    case "pending":
      return { held: false, message: "Checking with PayPal…", problem: false, canApprove: false };
    case "unknown":
      return { held: false, message: "We couldn’t confirm this with PayPal yet. Don’t approve it again; this page will update.", problem: false, canApprove: false };
    case "declined":
      return { held: false, message: "PayPal didn’t approve this hold. Nothing was taken. Try again, or pick another way to pay in PayPal.", problem: true, canApprove: true };
    case "closed":
      return { held: false, message: "You closed PayPal. Nothing was held.", problem: false, canApprove: true };
    default:
      return { held: false, message: null, problem: false, canApprove: true };
  }
}

/**
 * The holds as a whole: "{held} of {n} held", the all-held line, and whether
 * PayPal still owes an answer (so the page asks the API again).
 *
 * @param holds - every post's hold
 * @param creator - the creator's name
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17, CH-FR-19
 */
export function holdsSummary(holds: Hold[], creator: string) {
  const held = holds.filter((h) => h.state === "held").length;
  return {
    heading: `${held} of ${holds.length} held`,
    allHeld: held === holds.length ? `All held. ${creator} is making the posts.` : null,
    waiting: holds.some((h) => h.state === "pending" || h.state === "unknown"),
  };
}

/**
 * One post's hold, as the creator's invite page shows it once the brand has
 * agreed. A post not yet held says who has to act, never just "processing".
 *
 * @param hold - the post's hold state from the API
 * @param context.brand - the brand's name
 * @param context.amount - the post's amount, a two-place decimal string
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-25
 */
export function creatorHoldLine(hold: Hold, { brand, amount }: { brand: string; amount: string }): { held: boolean; text: string } {
  if (hold.state !== "held") return { held: false, text: `Waiting for ${brand} to approve this hold. You can start on the posts that are held.` };
  const ref = hold.reference ? ` · PayPal ref ${hold.reference}` : "";
  const by = hold.deadline ? ` · Post by ${shortDate(hold.deadline)}` : "";
  return { held: true, text: `Held · ${formatAmount(amount)}${ref}${by}` };
}
