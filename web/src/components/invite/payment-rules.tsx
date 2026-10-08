/**
 * "How you'll be paid": the four fixed rules both sides agree to (IN-BR-06).
 * Not editable; the brand sees the same lines.
 *
 * @param brand - the brand's name
 * @see docs/specs/creator-invite-frd.md IN-FR-14
 */
export function PaymentRules({ brand }: { brand: string }) {
  return (
    <div className="mt-6 border-t border-line pt-[18px]">
      <h3 id="rules-heading" className="mb-2.5 text-body-strong font-extrabold">
        How you’ll be paid
      </h3>
      <ol aria-labelledby="rules-heading" className="grid list-decimal gap-2.5 pl-5 text-[14px] text-ink-2 marker:font-bold marker:text-ink-3">
        <li className="pl-1.5">{brand} approves a hold for each post. The money is reserved, not taken.</li>
        <li className="pl-1.5">
          Your draft is checked against the checklist. If every item passes, {brand} has 48 hours to object. If they don’t, it’s approved. Anything that
          doesn’t pass waits for you to fix it or for {brand} to accept it.
        </li>
        <li className="pl-1.5">Post by the deadline. Once the live post checks out, you’re paid to your PayPal.</li>
        <li className="pl-1.5">Miss the deadline, and the hold goes back to {brand}.</li>
      </ol>
    </div>
  );
}
