"use client";

import { lazy, Suspense } from "react";
import type { TrendPoint } from "@/lib/home/months";
import type { PerformanceFigures } from "@/lib/home/performance";
import { WhenVisible } from "./when-visible";

// AG Charts is loaded only when a trend line scrolls into view (HM-FR-14, ADR 2026-10-12).
const TrendLine = lazy(() => import("./paid-charts").then((m) => ({ default: m.TrendLine })));

type Trends = Partial<Record<keyof PerformanceFigures, TrendPoint[]>>;

const FIGURES: { key: keyof PerformanceFigures; name: string; line: string }[] = [
  { key: "onTime", name: "On time", line: "went live before their deadline" },
  { key: "passedFirstTime", name: "Passed first time", line: "passed every item on the first check" },
  { key: "timeToPaid", name: "Time to paid", line: "on average, from posting to paid" },
];

/**
 * "How you're doing": the performance figures, each a label, a count and what
 * it counts, with its trend line once three months have posts; stacked on
 * phones, side by side from `lg:`. Every trend line has its text for screen
 * readers. Left out when there is nothing to count. "Paid each month" is on
 * Payments (1.2).
 *
 * @param figures - the counts; an absent one has nothing to count
 * @param trends - each figure by month, where there are three months or more
 * @see docs/specs/creator-home-frd.md HM-FR-08 to HM-FR-11, HM-FR-13, HM-FR-14, HM-FR-21; DESIGN.md "Overview and Payments"
 */
export function HowYoureDoing({ figures, trends }: { figures: PerformanceFigures; trends: Trends }) {
  const shown = FIGURES.filter((f) => figures[f.key]);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="home-doing" className="mt-5 rounded-lg border border-line bg-surface p-[18px] shadow-panel lg:px-[26px] lg:py-[22px]">
      <h2 id="home-doing" className="font-head text-section-title font-bold">
        How you’re doing
      </h2>
      <ul className="mt-3 lg:grid lg:grid-cols-3">
        {shown.map((f) => {
          const points = trends[f.key];
          return (
            <li
              key={f.key}
              className="grid grid-cols-[1fr_96px] items-center gap-x-3.5 border-line-soft py-3 first:pt-1 not-first:border-t lg:grid-cols-1 lg:gap-y-2 lg:py-1 lg:not-first:border-t-0 lg:not-first:border-l lg:not-first:pl-[30px] lg:not-last:pr-[30px]"
            >
              <div>
                <p className="text-[13.5px] font-bold text-ink-2">{f.name}</p>
                <p className="text-[19px] leading-tight font-extrabold tabular-nums">{figures[f.key]}</p>
                <p className="text-[13px] text-ink-3">{f.line}</p>
              </div>
              {points && (
                <>
                  <WhenVisible className="h-[30px] w-full min-w-0 overflow-hidden">
                    <Suspense fallback={null}>
                      <TrendLine points={points} />
                    </Suspense>
                  </WhenVisible>
                  <p className="sr-only">{`${f.name} by month: ${points.map((p) => p.spoken).join(", ")}`}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
