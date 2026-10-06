"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistTab } from "@/lib/checklist/item-status";
import type { TabView } from "@/lib/deliverable/deliverable-view";

/**
 * The checklist's filter pills: All, Needs you, Passed, Waiting for {brand}
 * (only when something waits) and At live check, each with its count. Filters
 * one list, so these are toggle buttons rather than tabs with panels. On phones
 * the row scrolls sideways (it is navigation, not a table), and its right edge
 * fades while more filters are hidden off to the right.
 *
 * @param tabs - the visible filters with counts, from the deliverable view
 * @param value - the chosen filter
 * @param onChange - called with the filter the creator picks
 * @see docs/specs/creator-draft-check-frd.md DC-FR-20
 */
export function ChecklistFilter({
  tabs,
  value,
  onChange,
}: {
  tabs: TabView[];
  value: ChecklistTab;
  onChange: (tab: ChecklistTab) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack for sub-pixel widths.
    setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, tabs]);

  // The frame carries the border; only the scrolling row inside it fades, so the edge stays crisp.
  return (
    <div className="max-w-full overflow-hidden rounded-md border border-line bg-surface md:rounded-pill">
    <div
      ref={ref}
      role="group"
      aria-label="Filter checklist"
      onScroll={measure}
      data-more-right={moreRight || undefined}
      className="flex gap-1 overflow-x-auto p-1 [scrollbar-width:none] data-[more-right]:[mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]"
    >
      {tabs.map((tab) => {
        const pressed = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-pill px-3.5 text-tab font-bold transition-colors ${
              pressed ? "bg-espresso text-surface" : "text-ink-3 hover:text-ink"
            }`}
          >
            {tab.label} <span className="text-label opacity-80">{tab.count}</span>
          </button>
        );
      })}
    </div>
    </div>
  );
}
