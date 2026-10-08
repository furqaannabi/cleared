/**
 * The four fixed rules of how the money moves, which both sides agree to
 * (IN-BR-06). Not editable. The creator reads "How you'll be paid", the brand
 * "How payment works": the same rules, each from its own side.
 *
 * @param brand - the brand's name
 * @param creator - the creator's name; needed for the brand's side
 * @param side - whose page the rules are on (default "creator")
 * @see docs/specs/creator-invite-frd.md IN-FR-14, docs/specs/confirm-and-hold-frd.md CH-FR-05
 */
export function PaymentRules({ brand, creator = "", side = "creator" }: { brand: string; creator?: string; side?: "creator" | "brand" }) {
  const rules =
    side === "creator"
      ? [
          `${brand} approves a hold for each post. The money is reserved, not taken.`,
          `Your draft is checked against the checklist. If every item passes, ${brand} has 48 hours to object. If they don’t, it’s approved. Anything that doesn’t pass waits for you to fix it or for ${brand} to accept it.`,
          "Post by the deadline. Once the live post checks out, you’re paid to your PayPal.",
          `Miss the deadline, and the hold goes back to ${brand}.`,
        ]
      : [
          "You approve a hold for each post. The money is reserved, not taken.",
          `${creator}’s draft is checked against the checklist. If every item passes, you have 48 hours to object. If you don’t, it’s approved. Anything that doesn’t pass waits for ${creator} to fix it or for you to accept it.`,
          `${creator} posts by the deadline. Once the live post checks out, ${creator} is paid.`,
          `If ${creator} misses the deadline, the hold comes back to you.`,
        ];
  return (
    <div className="mt-6 border-t border-line pt-[18px]">
      <h3 id="rules-heading" className="mb-2.5 text-body-strong font-extrabold">
        {side === "creator" ? "How you’ll be paid" : "How payment works"}
      </h3>
      <ol aria-labelledby="rules-heading" className="grid list-decimal gap-2.5 pl-5 text-[14px] text-ink-2 marker:font-bold marker:text-ink-3">
        {rules.map((rule) => (
          <li key={rule} className="pl-1.5">
            {rule}
          </li>
        ))}
      </ol>
    </div>
  );
}
