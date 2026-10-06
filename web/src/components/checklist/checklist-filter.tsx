import type { ChecklistTab } from "@/lib/checklist/item-status";
import type { TabView } from "@/lib/deliverable/deliverable-view";

/**
 * The checklist's filter pills: All, Needs you, Passed, Waiting for {brand}
 * (only when something waits) and At live check, each with its count. Filters
 * one list, so these are toggle buttons rather than tabs with panels. On phones
 * the row scrolls sideways; it is navigation, not a table.
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
  return (
    <div
      role="group"
      aria-label="Filter checklist"
      className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-line bg-surface p-1 [scrollbar-width:none] md:rounded-pill"
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
  );
}
