"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import type { Deliverable } from "@/lib/deliverable/types";
import { DraftTimeline } from "./draft-timeline";

type Draft = NonNullable<Deliverable["draft"]>;

/**
 * The creator's draft: the video from the API's short-lived link, shaped
 * for its platform (16:9 for a YouTube video, 9:16 for Shorts and Reels),
 * with the evidence timeline underneath. Selecting an item seeks the video
 * to its moment.
 *
 * @param draft - the draft file, its length and its link
 * @param platform - sets the frame's shape
 * @param items - the checklist items, for the timeline
 * @param brandName - the deal's brand, for marker labels
 * @param selectedId - the selected item; the video seeks to it
 * @param onSelect - called when a timeline marker is chosen
 * @param refreshUrl - fetches a fresh link when the current one stops working
 * @param seekKey - bumped to play the selected item's moment again ("Play from")
 * @see docs/specs/creator-draft-check-frd.md DC-FR-23 to DC-FR-26, DC-FR-22
 */
export function DraftPlayer(props: PlayerProps) {
  // A new draft starts the player fresh: its link, failure and refresh state reset.
  return <Player key={props.draft.url} {...props} />;
}

type PlayerProps = {
  draft: Draft;
  platform: Deliverable["platform"];
  items: ItemView[];
  brandName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  refreshUrl: () => Promise<string | null>;
  seekKey?: number;
};

function Player({
  draft,
  platform,
  items,
  brandName,
  selectedId,
  onSelect,
  refreshUrl,
  seekKey = 0,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const vertical = platform !== "youtube_video";
  const [src, setSrc] = useState(draft.url);
  const [failed, setFailed] = useState(false);
  // DC-FR-26: one quiet refresh per failure; a link that loads clears it.
  const refreshed = useRef(false);
  const resumeAt = useRef<number | null>(null);

  async function getFreshLink() {
    resumeAt.current = videoRef.current?.currentTime ?? null;
    const url = await refreshUrl();
    if (url) {
      setSrc(url);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }

  function handleError() {
    if (refreshed.current) {
      setFailed(true);
      return;
    }
    refreshed.current = true;
    void getFreshLink();
  }

  // DC-FR-22: selecting an item moves the video to its moment.
  useEffect(() => {
    const start = items.find((i) => i.id === selectedId)?.evidence?.startSec;
    if (start == null || !videoRef.current) return;
    videoRef.current.currentTime = start;
    setCurrentSec(start);
  }, [selectedId, items, seekKey]);

  // DC-FR-23: "Play from" brings the video into view and plays it.
  const lastSeekKey = useRef(seekKey);
  useEffect(() => {
    if (seekKey === lastSeekKey.current) return;
    lastSeekKey.current = seekKey;
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    video.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    // A browser may refuse to play; the video is still at the moment.
    video.play?.()?.catch(() => {});
  }, [seekKey]);

  return (
    <div className="rounded-lg border border-line bg-surface p-2.5 shadow-panel md:p-3.5">
      <div
        data-testid="draft-frame"
        data-aspect={vertical ? "9:16" : "16:9"}
        className={`mx-auto overflow-hidden rounded-md bg-espresso-ink ${
          vertical ? "aspect-[9/16] w-[min(100%,calc(60dvh*9/16))]" : "aspect-video w-full"
        }`}
      >
        <video
          ref={videoRef}
          src={src}
          aria-label={`Draft video ${draft.fileName}`}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
          onError={handleError}
          onLoadedMetadata={(e) => {
            // Pick up where the creator was before the link was refreshed.
            if (resumeAt.current != null) e.currentTarget.currentTime = resumeAt.current;
            resumeAt.current = null;
          }}
          onLoadedData={() => {
            refreshed.current = false;
          }}
          className="size-full scroll-mt-20 object-contain"
        />
      </div>
      {failed && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-latte-wash px-3.5 py-2.5 text-[14px] text-ink-2">
          <span>We can’t load the video right now. Your results below are unaffected.</span>
          <button
            type="button"
            onClick={() => void getFreshLink()}
            className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-4 text-body-strong font-bold text-espresso hover:bg-latte-wash"
          >
            Try again
          </button>
        </div>
      )}
      <DraftTimeline
        items={items}
        brandName={brandName}
        durationSec={draft.durationSec}
        selectedId={selectedId}
        onSelect={onSelect}
        currentSec={currentSec}
      />
    </div>
  );
}
