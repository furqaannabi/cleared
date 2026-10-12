"use client";

import { lazy, Suspense } from "react";
import type { MonthPaid } from "@/lib/home/months";
import { WhenVisible } from "./when-visible";

// AG Charts is loaded only when the chart scrolls into view (HM-FR-14, ADR 2026-10-12).
const MonthBars = lazy(() => import("./paid-charts").then((m) => ({ default: m.MonthBars })));

/**
 * "Paid each month" on Payments, full width in its own panel: the last six
 * months' bars, the current month "so far", with the same figures as a list
 * for screen readers (the chart itself is hidden from them).
 *
 * @param months - the last six months' paid amounts
 * @see docs/specs/creator-home-frd.md HM-FR-12, HM-FR-14; DESIGN.md "Overview and Payments"
 */
export function PaidEachMonth({ months }: { months: MonthPaid[] }) {
  return (
    <section aria-labelledby="pay-month" className="mt-4 rounded-lg border border-line bg-surface p-[18px] shadow-panel lg:px-[26px] lg:py-[22px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 id="pay-month" className="font-head text-section-title font-bold">
          Paid each month
        </h2>
        <p className="text-[13.5px] text-ink-3">What you received</p>
      </div>
      <WhenVisible className="mt-2 h-[180px] w-full min-w-0 overflow-hidden lg:h-[240px]">
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
  );
}
