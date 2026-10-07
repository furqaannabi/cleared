"use client";

import { createContext, useContext, type ReactNode } from "react";
import { formatDuration } from "@/lib/deliverable/format";

const SeekContext = createContext<((itemId: string) => void) | null>(null);

/**
 * Lets any timestamp on the page play the draft from its item's moment,
 * without threading a callback through the checklist (DC-FR-23).
 *
 * @param seek - selects the item and plays the draft from its moment; null when there is no draft
 * @see docs/specs/creator-draft-check-frd.md DC-FR-23
 */
export function SeekProvider({ seek, children }: { seek: ((itemId: string) => void) | null; children: ReactNode }) {
  return <SeekContext.Provider value={seek}>{children}</SeekContext.Provider>;
}

/** The page's seek, or null where there is no draft to play. */
export function useSeek() {
  return useContext(SeekContext);
}

/**
 * "Play from 3:15": plays the draft from an item's moment (DC-FR-23).
 * Renders nothing where there is no draft to play, or the item has no time.
 *
 * @param itemId - the item whose moment to play
 * @param startSec - where its evidence starts, in seconds
 * @see docs/specs/creator-draft-check-frd.md DC-FR-23
 */
export function PlayFrom({ itemId, startSec }: { itemId: string; startSec: number | null | undefined }) {
  const seek = useSeek();
  if (!seek || startSec == null) return null;
  return (
    <button
      type="button"
      onClick={() => seek(itemId)}
      className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-pill border border-latte-line bg-surface px-3.5 text-chip font-bold text-espresso transition-colors hover:bg-latte-wash"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-current">
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
      </svg>
      Play from {formatDuration(startSec)}
    </button>
  );
}
