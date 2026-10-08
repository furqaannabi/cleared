"use client";

import type { BrandTermsView } from "@/lib/brand-deal/terms-view";
import { AskForChange } from "./ask-for-change";

/**
 * "Not on the checklist": the lines of the brand's brief that no item cites,
 * so nothing is dropped silently. A line the creator chose to leave out says so.
 *
 * @param lines - from the terms view
 * @param creator - the creator's name
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-09
 */
export function NotOnChecklist({ lines, creator }: { lines: BrandTermsView["notOnChecklist"]; creator: string }) {
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="not-on-checklist" className="mt-[22px] border-t border-line pt-[18px]">
      <h3 id="not-on-checklist" className="text-[15.5px] font-extrabold">
        Not on the checklist
      </h3>
      <p className="mt-0.5 text-meta text-ink-3">These won’t be checked.</p>
      <ul className="mt-1">
        {lines.map((line) => (
          <li key={line.number} className="grid gap-0.5 border-t border-line-soft py-3 first:border-t-0">
            <span className="text-[14.5px]">“{line.text}”</span>
            {line.leftOut && <span className="text-meta text-ink-3">{creator} left this out.</span>}
            <AskForChange about={{ kind: "line", briefLine: line.number }} target={`“${line.text}”`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
