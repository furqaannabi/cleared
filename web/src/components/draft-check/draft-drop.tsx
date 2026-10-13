"use client";

import type { ReactNode } from "react";
import { useFileDrag } from "@/lib/hooks/use-file-drag";

/**
 * The player area as the drop target (look A of
 * design/draft-upload/drag-and-drop.html). From `md:`, while a file is dragged
 * over the window, the player area turns latte with a dashed outline saying
 * where the draft goes, or that no upload is possible now; a drop anywhere on
 * the page is handed over only when an upload is offered.
 *
 * @param on - desktop: listen for drags at all
 * @param canUpload - an upload action is offered and nothing is uploading
 * @param hasDraft - a draft is on screen, so a drop is a new draft
 * @param onDrop - the files dropped, when an upload is offered
 * @param children - the player area
 * @see docs/specs/creator-draft-check-frd.md DC-FR-56 (1.28)
 */
export function DraftDrop({ on, canUpload, hasDraft, onDrop, children }: { on: boolean; canUpload: boolean; hasDraft: boolean; onDrop: (files: File[]) => void; children: ReactNode }) {
  const over = useFileDrag(on, (files) => {
    if (canUpload) onDrop(files);
  });
  return (
    <div className="relative">
      {children}
      {over && (
        <div
          role="status"
          className={`pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg text-center outline-2 -outline-offset-8 outline-dashed ${
            canUpload ? "bg-latte/95 outline-espresso" : "bg-latte-wash/95 outline-ink-4"
          }`}
        >
          <div className="grid justify-items-center gap-1.5 px-4">
            {canUpload ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-8 text-espresso">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-8 text-ink-2">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M6 18 18 6" />
              </svg>
            )}
            <p className={`text-body-strong font-bold ${canUpload ? "text-espresso" : "text-ink-2"}`}>
              {canUpload ? (hasDraft ? "Drop to upload your new draft" : "Drop to upload your draft") : "You can’t upload a draft right now."}
            </p>
            {canUpload && <p className="text-meta text-ink-3">{hasDraft ? "We check it against the checklist again" : "MP4 or MOV, up to 1 GB"}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
