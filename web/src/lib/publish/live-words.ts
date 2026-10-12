import type { Deliverable } from "@/lib/deliverable/types";

type LiveCheck = NonNullable<Deliverable["liveCheck"]>;
type Undecided = Extract<LiveCheck, { state: "undecided" }>["what"][number];
type NotFixable = Extract<LiveCheck, { state: "not_fixable" }>["reason"];
type PayoutReason = NonNullable<NonNullable<Deliverable["payout"]>["reason"]>;

const UNDECIDED: Record<Undecided, string> = {
  file_record: "whether it’s the same file",
  paid_promotion: "YouTube’s paid promotion label",
  written_item: "a written item",
};

/**
 * What the live check couldn't decide, in words joined with "and".
 *
 * @param what - the API's codes
 * @see docs/specs/publish-and-pay-frd.md PP-FR-14, PP-FR-27
 */
export function undecidedWords(what: readonly Undecided[]): string {
  const words = what.map((w) => UNDECIDED[w]);
  if (words.length < 2) return words[0] ?? "something";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * Why a live post can't be fixed, for the creator.
 *
 * @see docs/specs/publish-and-pay-frd.md PP-FR-13
 */
export const notFixableWords: Record<NotFixable, string> = {
  not_the_approved_file: "Your live post doesn’t match the approved draft.",
  not_your_channel: "Your live post isn’t on your connected channel.",
};

/**
 * Why PayPal couldn't pay the creator, in words.
 *
 * @see docs/specs/publish-and-pay-frd.md PP-FR-20
 */
export const payoutReasonWords: Record<PayoutReason, string> = {
  returned: "PayPal sent it back: there’s no PayPal account for that email, or it can’t receive money.",
  blocked: "PayPal blocked the payment to that account.",
  denied: "PayPal turned the payment down for that account.",
  failed: "PayPal couldn’t complete it.",
};
