"use client";

import { useState } from "react";
import { Seal } from "@/components/ui/seal";
import type { Deliverable } from "@/lib/deliverable/types";

/**
 * DC-FR-51: the draft is approved, by the brand or by its window ending.
 * Not "publish now": the next-step bar says the hold is confirmed first.
 *
 * @param deliverable - an approved deliverable
 * @see docs/specs/creator-draft-check-frd.md DC-FR-51
 */
export function ApprovedBanner({ deliverable }: { deliverable: Deliverable }) {
  const b = deliverable.brandName;
  return (
    <section aria-labelledby="approved-heading" className="mt-5 flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-4 md:px-5">
      <Seal fillClassName="fill-latte" className="size-11 shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Seal>
      <div className="min-w-0">
        <h2 id="approved-heading" className="text-item-title font-bold">
          Draft approved
        </h2>
        <p className="mt-0.5 text-[14px] text-ink-2 md:text-body">
          {deliverable.approvedBy === "window" ? `No objection from ${b} in 48 hours, so this draft is approved.` : `${b} approved this draft.`}
        </p>
      </div>
    </section>
  );
}

/**
 * DC-FR-52: while the brand has something to do on this deliverable, a link
 * the creator can copy and send them. The link is copied, never shown in
 * full, stored or logged.
 *
 * @param deliverable - the deliverable, with its review link from the API
 * @see docs/specs/creator-draft-check-frd.md DC-FR-52; docs/decisions/2026-10-08-fresh-brand-link-per-review.md
 */
export function CopyReviewLink({ deliverable }: { deliverable: Deliverable }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const link = deliverable.reviewLink;
  if (!link) return null;
  const b = deliverable.brandName;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link!.url);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-ink-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso"
      >
        Copy link for {b}
      </button>
      <span aria-live="polite">
        {copied === "yes" ? "Copied" : copied === "no" ? "Couldn’t copy. Try again." : link.emailedTo ? `We’ve emailed it to ${link.emailedTo}.` : `Send it to ${b} so they can review.`}
      </span>
    </div>
  );
}
