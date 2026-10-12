"use client";

import { BarSeriesModule, CartesianChartModule, CategoryAxisModule, LineSeriesModule, ModuleRegistry, NumberAxisModule, type AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import type { MonthPaid, TrendPoint } from "@/lib/home/months";

// Only what the two charts use, to keep the lazy chunk down.
ModuleRegistry.registerModules([CartesianChartModule, BarSeriesModule, LineSeriesModule, CategoryAxisModule, NumberAxisModule]);

// DESIGN.md tokens, read once from the page so the charts share the app's colours.
const token = (name: string, fallback: string) =>
  (typeof window !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

/**
 * "Paid each month" drawn with AG Charts: espresso bars with their amounts
 * above, the current month hatched lighter. No animation (reduced motion and
 * calm). Hidden from screen readers; the page gives the text.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-12, HM-FR-14
 */
export function MonthBars({ months }: { months: MonthPaid[] }) {
  const espresso = token("--color-espresso", "#3f3322");
  const options: AgCartesianChartOptions = {
    data: months.map((m) => ({ month: m.current ? `${m.label}\nso far` : m.label, amount: m.amountMinor / 100, text: m.amountMinor ? m.text.replace(/\.00$/, "") : "", current: m.current })),
    background: { visible: false },
    animation: { enabled: false },
    padding: { top: 24, right: 0, bottom: 0, left: 0 },
    series: [
      {
        type: "bar",
        xKey: "month",
        yKey: "amount",
        cornerRadius: 6,
        fill: espresso,
        itemStyler: ({ datum }) => ({ fill: datum.current ? token("--color-espresso-hover", "#554631") : espresso }),
        label: { enabled: true, placement: "outside-end", formatter: ({ datum }) => datum.text, fontWeight: 700, fontSize: 11.5, color: token("--color-ink-2", "#4a4339") },
        tooltip: { enabled: false },
      },
    ],
    axes: {
      x: { type: "category", position: "bottom", label: { color: token("--color-ink-3", "#675f55"), fontSize: 12, autoRotate: false, avoidCollisions: false }, line: { enabled: false } },
      y: { type: "number", position: "left", label: { enabled: false }, gridLine: { enabled: false }, line: { enabled: false } },
    },
  };
  return <AgCharts options={options} style={{ width: "100%", height: "100%" }} />;
}

/**
 * One figure's small trend line, drawn with AG Charts: an espresso line with
 * no axes. Hidden from screen readers; the page gives the text.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-13, HM-FR-14
 */
export function TrendLine({ points }: { points: TrendPoint[] }) {
  const options: AgCartesianChartOptions = {
    data: points.map((p) => ({ month: p.month, value: p.value })),
    background: { visible: false },
    animation: { enabled: false },
    padding: { top: 4, right: 4, bottom: 4, left: 4 },
    series: [{ type: "line", xKey: "month", yKey: "value", stroke: token("--color-espresso", "#3f3322"), strokeWidth: 2, marker: { enabled: false }, tooltip: { enabled: false } }],
    axes: {
      x: { type: "category", position: "bottom", label: { enabled: false }, line: { enabled: false } },
      y: { type: "number", position: "left", label: { enabled: false }, gridLine: { enabled: false }, line: { enabled: false } },
    },
  };
  return <AgCharts options={options} style={{ width: "100%", height: "100%" }} />;
}
