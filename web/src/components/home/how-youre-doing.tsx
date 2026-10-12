"use client";

import { lazy, Suspense } from "react";
import type { MonthPaid, TrendPoint } from "@/lib/home/months";
import type { PerformanceFigures } from "@/lib/home/performance";
import { WhenVisible } from "./when-visible";

// AG Charts is loaded only when a chart scrolls into view (HM-FR-14, ADR 2026-10-12).
const MonthBars = lazy(() => import("./paid-charts").then((m) => ({ default: m.MonthBars })));
const TrendLine = lazy(() => import("./paid-charts").then((m) => ({ default: m.TrendLine })));

type Trends = Partial<Record<keyof PerformanceFigures, TrendPoint[]>>;

const FIGURES: { key: keyof PerformanceFigures; name: string; line: string }[] = [
  { key: "onTime", name: "On time", line: "went live before their deadline" },
  { key: "passedFirstTime", name: "Passed first time", line: "passed every item on the first check" },
  { key: "timeToPaid", name: "Time to paid", line: "on average, from posting to paid" },
];

/**
 * "How you're doing": the performance figures (each a label, a count and what
 * it counts, with its trend line once three months have posts) and "Paid each
 * month" once anything is paid. Every chart has its text for screen readers;
 * the charts themselves are hidden from them. Left out when there is nothing
 * to show.
 *
 * @param figures - the counts; an absent one has nothing to count
 * @param trends - each figure by month, where there are three months or more
 * @param months - the last six months' paid amounts, or null before anything is paid
 * @see docs/specs/creator-home-frd.md HM-FR-08 to HM-FR-14; DESIGN.md "Creator home"
 */
export function HowYoureDoing({ figures, trends, months }: { figures: PerformanceFigures; trends: Trends; months: MonthPaid[] | null }) {
  const shown = FIGURES.filter((f) => figures[f.key]);
  if (shown.length === 0 && !months) return null;
  return (
    <section aria-labelledby="home-doing" className="mt-5 rounded-lg border border-line bg-surface p-[18px] shadow-panel lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-[34px] lg:px-[26px] lg:py-[22px]">
      <div>
        <h2 id="home-doing" className="font-head text-section-title font-bold">
          How you’re doing
        </h2>
        <ul className="mt-3">
          {shown.map((f) => {
            const points = trends[f.key];
            return (
              <li key={f.key} className="grid grid-cols-[1fr_96px] items-center gap-x-3.5 border-line-soft py-3 first:pt-1 not-first:border-t">
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
      </div>
      {months && (
        <section aria-labelledby="home-paid-month" className="mt-3.5 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:border-line-soft lg:pt-0 lg:pl-[34px]">
          <div className="flex items-baseline justify-between gap-2.5">
            <h3 id="home-paid-month" className="text-[15px] font-bold">
              Paid each month
            </h3>
            <p className="text-[13.5px] text-ink-3">What you received</p>
          </div>
          <WhenVisible className="mt-2 h-[180px] w-full min-w-0 overflow-hidden lg:h-[220px]">
            <Suspense fallback={null}>
              <MonthBars months={months} />
            </Suspense>
          </WhenVisible>
          <ul className="sr-only">
            {months.map((m) => (
              <li key={m.label}>{m.spoken}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
