"use client";

import type { components } from "contract";
import { useOptionalDeals } from "@/components/shell/use-deals";
import { keepingEmailNote } from "@/lib/invite/keeping-email";

/**
 * Under the PayPal email after a new one is saved: the payouts already with
 * PayPal, which keep the email they were sent to. Nothing when there are none.
 *
 * @param posts - the API's `postsKeepingEmail` from the last save
 * @see docs/specs/creator-invite-frd.md IN-FR-12 (1.3)
 */
export function KeepingEmail({ posts }: { posts: components["schemas"]["PostKeepingEmail"][] }) {
  const deals = useOptionalDeals();
  const note = keepingEmailNote(posts, deals?.status === "ready" ? deals.deals : []);
  if (!note) return null;
  return (
    <div role="status" aria-label="Payouts keeping the old email" className="mt-2 rounded-md bg-latte-wash px-3.5 py-2.5 text-meta text-ink-2">
      <p>{note.lead}</p>
      <ul className="mt-1 grid gap-0.5 font-semibold text-ink">
        {note.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
