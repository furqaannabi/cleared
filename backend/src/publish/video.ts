/**
 * A YouTube video's link, and whether its file is the approved draft's (publish to paid spec PT-FR-01,
 * PT-FR-02, PT-FR-04). Pure code. A link is the creator's own text and is never fetched: only an id is
 * taken from it, and only from YouTube's own addresses.
 */

/** YouTube's own hosts, and where each keeps a video's id. */
const HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be", "studio.youtube.com"]);
const ID = /^[A-Za-z0-9_-]{11}$/;
const LINK_MAX = 2000;

/** The id of the video a link points to, or nothing if it is not a link to a YouTube video. */
export function videoIdFrom(link: string): string | undefined {
  const text = link.trim();
  if (!text || text.length > LINK_MAX || !URL.canParse(text)) return undefined;
  const url = new URL(text);
  // The host is compared whole, so a look-alike address, or YouTube's name before an "@", is another site.
  if (url.protocol !== "https:" || url.username || url.password || !HOSTS.has(url.hostname)) return undefined;

  const [first, second] = url.pathname.split("/").filter(Boolean);
  const id =
    url.hostname === "youtu.be"
      ? first
      : url.hostname === "studio.youtube.com"
        ? first === "video" ? second : undefined
        : first === "watch"
          ? (url.searchParams.get("v") ?? undefined)
          : first === "shorts"
            ? second
            : undefined;
  return id && ID.test(id) ? id : undefined;
}

/** How far a video's length may be from the draft's and still be the same file: YouTube rounds it. */
export const LENGTH_TOLERANCE_SEC = 1;

/**
 * Whether YouTube's record of an upload is the approved draft's file: the same size in bytes, and the
 * same length to within a second. "unknown" when YouTube did not return enough to say (PT-FR-04). A
 * part of the record that is there and differs is enough to say it is a different file.
 */
export function sameFile(
  draft: { sizeBytes: bigint | number; durationSec: number },
  record: { fileSizeBytes?: bigint | number; durationSec?: number },
  toleranceSec = LENGTH_TOLERANCE_SEC,
): "same" | "different" | "unknown" {
  const size = record.fileSizeBytes === undefined ? undefined : BigInt(record.fileSizeBytes) === BigInt(draft.sizeBytes);
  const length = record.durationSec === undefined ? undefined : Math.abs(record.durationSec - draft.durationSec) <= toleranceSec;
  if (size === false || length === false) return "different";
  return size && length ? "same" : "unknown";
}
