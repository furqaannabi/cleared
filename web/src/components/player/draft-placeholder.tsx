import type { Deliverable } from "@/lib/deliverable/types";

/**
 * The player's space before a draft exists: a quiet latte panel in the
 * post's shape with "No draft yet" and a play mark, saying the draft will play
 * here. It is not an upload target (no dashed border, no upload arrow): the
 * upload action is the next-step bar's (DESIGN.md "No draft").
 *
 * @param platform - sets the frame's shape
 * @see docs/specs/creator-draft-check-frd.md DC-FR-02
 */
export function DraftPlaceholder({ platform }: { platform: Deliverable["platform"] }) {
  const vertical = platform !== "youtube_video";
  return (
    <section aria-label="No draft yet" className="rounded-lg border border-line bg-surface p-2.5 shadow-panel md:p-3.5">
      <div
        data-testid="draft-frame"
        data-aspect={vertical ? "9:16" : "16:9"}
        // Phones: a short panel (there is no video to frame yet); md: and up, the post's shape.
        className={`mx-auto grid min-h-40 w-full place-items-center rounded-md bg-latte-wash px-4 py-6 text-center ${
          vertical ? "md:aspect-[9/16] md:w-[min(100%,calc(60dvh*9/16))]" : "md:aspect-video"
        }`}
      >
        <div className="grid justify-items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-8 text-ink-4">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" />
          </svg>
          <p className="text-body-strong font-bold text-ink-2">No draft yet</p>
          <p className="max-w-[28ch] text-meta text-ink-3">Your draft will play here once you upload it.</p>
        </div>
      </div>
    </section>
  );
}
