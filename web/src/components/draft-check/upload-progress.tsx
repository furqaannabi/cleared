import { formatBytes } from "@/lib/draft/format-bytes";
import type { Uploading } from "./use-draft-upload";

/**
 * Design A (design/draft-upload/option-a.html): while a draft uploads it takes
 * the player's place, in the video's own frame: the file and its size, the
 * percentage large, a marigold bar and Cancel. Nothing to press on phones
 * but Cancel, so the fixed bar steps aside.
 *
 * @param uploading - the file and how far it has got
 * @param vertical - a 9:16 post (Shorts, Reels)
 * @param onCancel - stops the upload
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18)
 */
export function UploadProgress({ uploading, vertical, onCancel }: { uploading: Uploading; vertical: boolean; onCancel: () => void }) {
  const { fileName, size, percent } = uploading;
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5 shadow-panel">
      <section
        aria-label="Uploading your draft"
        className={`grid content-center gap-3 rounded-md border-[1.5px] border-dashed border-latte-line bg-latte-wash px-5 py-5 ${vertical ? "mx-auto aspect-[9/16] max-h-[560px]" : "aspect-video"}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-bold">{fileName}</span>
          <span className="flex-none text-meta text-ink-3">{formatBytes(size)}</span>
        </div>
        <span className="font-head text-[40px] leading-none font-extrabold tabular-nums md:text-[56px]" aria-hidden="true">
          {percent}%
        </span>
        <div
          role="progressbar"
          aria-label={`Uploading ${fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 overflow-hidden rounded-pill bg-latte"
        >
          <span className="block h-full rounded-pill bg-marigold transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-meta text-ink-3">Keep this page open. The check starts on its own.</span>
          <button type="button" onClick={onCancel} className="inline-flex min-h-11 flex-none items-center font-bold text-espresso underline underline-offset-3">
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
