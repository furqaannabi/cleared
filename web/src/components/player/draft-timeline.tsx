import { StatusSeal } from "@/components/checklist/status-seal";
import { describeStatus } from "@/lib/checklist/item-status";
import { itemTime } from "@/lib/checklist/item-labels";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { formatDuration } from "@/lib/deliverable/format";

/**
 * The draft's timeline: a seal marker at every item with a single
 * timestamp, a band for every item with a time range, the playhead, and
 * time ticks. Choosing a marker selects its item (which seeks the video).
 * Items still being checked, or not checked yet, have no marker.
 *
 * @param items - the checklist items
 * @param brandName - the deal's brand, for marker labels
 * @param durationSec - the draft's length
 * @param selectedId - the selected item, or null
 * @param onSelect - called with the item whose marker is chosen
 * @param currentSec - where the playhead is
 * @see docs/specs/creator-draft-check-frd.md DC-FR-24, DC-FR-22; DESIGN.md "Evidence timeline"
 */
export function DraftTimeline({
  items,
  brandName,
  durationSec,
  selectedId,
  onSelect,
  currentSec = 0,
}: {
  items: ItemView[];
  brandName: string;
  durationSec: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentSec?: number;
}) {
  const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / durationSec) * 100))}%`;
  const placed = items
    .filter((i) => i.evidence?.startSec != null && i.status !== "checking" && i.status !== "not_checked")
    .sort((a, b) => a.evidence!.startSec! - b.evidence!.startSec! || Number(a.evidence?.endSec != null) - Number(b.evidence?.endSec != null));
  const label = (i: ItemView) => `${i.name}, ${describeStatus(i.status, brandName).label}, at ${itemTime(i)}`;

  const band = (i: ItemView) => {
    const selected = i.id === selectedId;
    const start = pct(i.evidence!.startSec!);
    return (
      // A tall hit area around the 8px band. Markers sit above it, so the strip
      // below them (over the time ticks) always reaches the band.
      <button
        key={i.id}
        type="button"
        data-testid={`band-${i.id}`}
        aria-pressed={selected}
        aria-label={label(i)}
        onClick={() => onSelect(i.id)}
        className="group absolute top-4 h-[60px] min-w-11"
        style={{ left: start, width: `calc(${pct(i.evidence!.endSec!)} - ${start})` }}
      >
        <span
          className={`absolute inset-x-0 top-[18px] h-2 rounded-pill transition-colors ${
            selected ? "bg-espresso" : "bg-espresso/30 group-hover:bg-espresso/50"
          }`}
        />
      </button>
    );
  };

  const marker = (i: ItemView) => {
    const selected = i.id === selectedId;
    return (
      <button
        key={i.id}
        type="button"
        aria-pressed={selected}
        aria-label={label(i)}
        onClick={() => onSelect(i.id)}
        className={`absolute top-0.5 z-10 -ml-[22px] grid size-11 place-items-center rounded-full transition-transform duration-150 ease-out-expo hover:-translate-y-0.5 ${selected ? "-translate-y-[3px] scale-110" : ""}`}
        style={{ left: pct(i.evidence!.startSec!) }}
      >
        <StatusSeal status={i.status} className="size-[26px]" />
      </button>
    );
  };

  return (
    <div>
      <div className="relative mx-1.5 mt-[18px] mb-1 h-[58px]">
        <div className="absolute inset-x-0 top-[34px] h-2 rounded-pill bg-line-soft" />
        <div
          className="absolute top-[34px] left-0 h-2 rounded-pill bg-latte-line transition-[width] duration-300 ease-out-expo"
          style={{ width: pct(currentSec) }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[26px] z-[5] -ml-[1.5px] h-6 w-[3px] rounded-bar bg-ink transition-[left] duration-300 ease-out-expo"
          style={{ left: pct(currentSec) }}
        />
        {/* In time order (a marker before a band at the same moment), so Tab moves along the timeline. */}
        {placed.map((i) => (i.evidence?.endSec != null ? band(i) : marker(i)))}
      </div>
      <div aria-hidden="true" className="mx-1.5 flex justify-between text-label font-medium text-ink-3">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>{formatDuration(durationSec * f)}</span>
        ))}
      </div>
    </div>
  );
}
