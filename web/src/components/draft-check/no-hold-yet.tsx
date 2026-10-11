"use client";

import Link from "next/link";
import { Seal } from "@/components/ui/seal";
import { useOptionalDeals } from "@/components/shell/use-deals";

/**
 * A post whose hold isn't in place yet has no draft check (the API answers
 * `not_held`): the page says why and points to the deal's terms. The brand's
 * name comes from the deals list; without it, "The brand".
 *
 * @param dealId - the deal the post belongs to
 * @see docs/specs/creator-draft-check-frd.md DC-FR-54 (1.18); design/draft-upload/shared.html
 */
export function NoHoldYet({ dealId }: { dealId: string }) {
  const deals = useOptionalDeals();
  const brand = (deals?.status === "ready" && deals.deals.find((d) => d.id === dealId)?.brandName) || "The brand";
  return (
    <section className="grid min-h-[420px] place-items-center rounded-lg border border-line bg-surface px-6 py-12 text-center">
      <div className="grid max-w-[420px] justify-items-center gap-3">
        <Seal fillClassName="fill-latte" className="size-14">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </Seal>
        <h1 className="font-head text-[24px] leading-tight font-bold">{`${brand} hasn’t approved this post’s hold yet.`}</h1>
        <p className="text-body text-ink-3">Its draft check opens once the money is held.</p>
        <Link href={`/deals/${dealId}/invite`} className="inline-flex min-h-11 items-center font-bold text-espresso underline underline-offset-3">
          See the deal’s terms
        </Link>
      </div>
    </section>
  );
}
