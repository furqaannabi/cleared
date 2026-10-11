// DC-FR-45 (1.18): the draft limits, from docs/decisions/2026-10-09-limits-on-drafts.md. The API's answer wins.
/** The largest draft the API takes: 1 GB. */
export const MAX_DRAFT_BYTES = 1024 ** 3;
/** The longest draft the API checks: 15 minutes. */
export const MAX_DRAFT_SECONDS = 900;

const TYPES = ["video/mp4", "video/quicktime"];
const EXTENSIONS = /\.(mp4|mov)$/i;

/** Why a draft file can't be sent, as the page explains it (DC-FR-08, DC-FR-45). */
export type DraftFileProblem = { kind: "format" } | { kind: "too_big"; size: number } | { kind: "too_long"; lengthSec: number; lengthCapSec: number };

/**
 * Checks a draft file with what the browser can see, before anything is sent:
 * an MP4 or MOV (by type, or by extension when the browser gives no type), at
 * most 1 GB and 15 minutes. A length the browser couldn't read is left to the API.
 *
 * @param file - the picked file's name, type and size
 * @param lengthSec - its length from the video's own metadata, or null
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18)
 */
export function checkDraftFile(file: { name: string; type: string; size: number }, lengthSec: number | null): { ok: true } | { ok: false; problem: DraftFileProblem } {
  const known = file.type ? TYPES.includes(file.type) : EXTENSIONS.test(file.name);
  if (!known) return { ok: false, problem: { kind: "format" } };
  if (file.size > MAX_DRAFT_BYTES) return { ok: false, problem: { kind: "too_big", size: file.size } };
  if (lengthSec !== null && lengthSec > MAX_DRAFT_SECONDS) return { ok: false, problem: { kind: "too_long", lengthSec, lengthCapSec: MAX_DRAFT_SECONDS } };
  return { ok: true };
}

/**
 * A video file's length in seconds, read from its own metadata by the
 * browser without uploading it; null when the browser can't read it.
 *
 * @param file - the picked file
 */
export function readVideoLength(file: Blob, timeoutMs = 5000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (length: number | null) => {
      clearTimeout(timer);
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(length);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}
