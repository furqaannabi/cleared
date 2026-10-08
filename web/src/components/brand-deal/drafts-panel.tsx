"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BrandDeal } from "@/lib/brand-deal/types";
import { postLines } from "@/lib/brand-review/post-lines";
import { PlatformMark } from "./platform-mark";

const ACTION = {
  primary: "inline-flex min-h-11 items-center justify-center rounded-pill bg-espresso px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover",
  outline: "inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso",
  link: "inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3",
};

/**
 * "Drafts": once every post is held, where each post's draft stands, the
 * posts that need the brand first, each linking to its review. Nothing
 * before a post's draft check exists.
 *
 * @param deal - the deal as the brand sees it
 * @see docs/specs/brand-review-frd.md RW-FR-01, RW-FR-02; DESIGN.md "Brand review"
 */
export function DraftsPanel({ deal }: { deal: BrandDeal }) {
  const [now, setNow] = useState(() => new Date());
  // The time left moves on; the API still decides when a window ends.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const lines = postLines(deal, now);
  if (!lines.length) return null;
  return (
    <section aria-label="Drafts" className="grid gap-1 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 className="font-head text-[17px] font-extrabold">Drafts</h2>
      <div>
        {lines.map((l) => (
          <div key={l.deliverableId} role="group" aria-label={l.label} className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-t border-line-soft py-3.5 first:border-t-0">
            <PlatformMark platform={l.platform} />
            <div className="grid gap-0.5">
              <b className="text-[15px]">{l.label}</b>
              <p className={`text-[13.5px] ${l.needsYou ? "font-bold text-ink" : "text-ink-2"}`}>{l.text}</p>
            </div>
            {l.action && (
              <Link href={l.action.href} className={`col-start-2 justify-self-start ${ACTION[l.action.style]}`}>
                {l.action.text}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
