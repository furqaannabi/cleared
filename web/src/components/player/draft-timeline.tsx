"use client";

import { useEffect, useRef, useState } from "react";
import { StatusSeal } from "@/components/checklist/status-seal";
import { describeStatus } from "@/lib/checklist/item-status";
import { itemTime } from "@/lib/checklist/item-labels";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { formatDuration } from "@/lib/deliverable/format";
import { markerLanes } from "./marker-lanes";

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
 * @param widthPx - the timeline's width (tests); measured otherwise, to lift close markers to a second row
 * @see docs/specs/creator-draft-check-frd.md DC-FR-24, DC-FR-22; DESIGN.md "Evidence timeline"
 */
export function DraftTimeline({
  items,
  brandName,
  durationSec,
  selectedId,
  onSelect,
  currentSec = 0,
  widthPx,
}: {
  items: ItemView[];
  brandName: string;
  durationSec: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentSec?: number;
  widthPx?: number;
}) {
  const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / durationSec) * 100))}%`;
  // DC-FR-24: markers closer than a tap target (44px) at this width take a second row.
  const trackRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const width = widthPx ?? measured;
  const placed = items
    .filter((i) => i.evidence?.startSec != null && i.status !== "checking" && i.status !== "not_checked")
    .sort((a, b) => a.evidence!.startSec! - b.evidence!.startSec! || Number(a.evidence?.endSec != null) - Number(b.evidence?.endSec != null));
  const pointMarkers = placed.filter((i) => i.evidence?.endSec == null);
  const lanes = new Map(
    markerLanes(
      pointMarkers.map((i) => (width * Math.min(1, i.evidence!.startSec! / durationSec))),
      44,
    ).map((lane, k) => [pointMarkers[k].id, width > 0 ? lane : 0]),
  );
  const lifted = [...lanes.values()].includes(1);
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
    const lane = lanes.get(i.id) ?? 0;
    return (
      <button
        key={i.id}
        type="button"
        aria-pressed={selected}
        aria-label={label(i)}
        data-lane={lane}
        onClick={() => onSelect(i.id)}
        className={`absolute z-10 -ml-[22px] grid size-11 place-items-center rounded-full transition-transform duration-150 ease-out-expo hover:-translate-y-0.5 ${
          lane === 1 ? "-top-[38px]" : "top-0.5"
        } ${selected ? "-translate-y-[3px] scale-110" : ""}`}
        style={{ left: pct(i.evidence!.startSec!) }}
      >
        <StatusSeal status={i.status} className="size-[26px]" />
        {/* A lifted marker keeps a short stem down to its moment on the timeline. */}
        {lane === 1 && <span aria-hidden="true" className="absolute top-[38px] left-1/2 -ml-px h-[30px] w-0.5 rounded-bar bg-latte-line" />}
      </button>
    );
  };

  return (
    <div>
      <div ref={trackRef} className={`relative mx-1.5 mb-1 h-[58px] ${lifted ? "mt-[58px]" : "mt-[18px]"}`}>
        <div className="absolute inset-x-0 top-[34px] h-2 rounded-pill bg-line-soft" />
        {/* How far the video has played. Clipped rather than resized, so moving it never costs a layout. */}
        <div
          className="absolute inset-x-0 top-[34px] h-2 rounded-pill bg-latte-line transition-[clip-path] duration-300 ease-out-expo"
          style={{ clipPath: `inset(0 calc(100% - ${pct(currentSec)}) 0 0 round 999px)` }}
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
