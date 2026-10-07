"use client";

import { Sheet } from "@/components/ui/sheet";

/**
 * "View brief": the deal's brief, read-only, every line numbered, with the
 * selected item's line marked. Every checklist item cites one of these lines.
 *
 * @param brief - the brief's numbered lines
 * @param brandName - the deal's brand, for the title
 * @param highlightLine - the selected item's brief line number, or null
 * @see docs/specs/creator-draft-check-frd.md DC-FR-30
 */
export function BriefSheet({
  brief,
  brandName,
  highlightLine,
}: {
  brief: { number: number; text: string }[];
  brandName: string;
  highlightLine: number | null;
}) {
  return (
    <Sheet
      title={`${brandName}’s brief`}
      trigger={
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-[18px] text-body-strong font-bold text-espresso transition-colors hover:bg-latte-wash"
        >
          View brief
        </button>
      }
    >
      <ol className="flex flex-col gap-1">
        {brief.map((line) => {
          const marked = line.number === highlightLine;
          return (
            <li
              key={line.number}
              aria-current={marked || undefined}
              className={`grid grid-cols-[2.25rem_1fr] gap-2 rounded-sm px-2 py-2 ${marked ? "bg-latte" : ""}`}
            >
              <span className="text-label font-bold text-ink-3 tabular-nums">Line {line.number}</span>
              <span className={marked ? "font-semibold text-ink" : "text-ink-2"}>{line.text}</span>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
