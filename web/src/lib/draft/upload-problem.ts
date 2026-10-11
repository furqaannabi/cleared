import type { ApiResult } from "@/lib/api";
import { formatDuration } from "@/lib/deliverable/format";
import type { DraftFileProblem } from "./check-draft-file";

/**
 * What the page shows when a draft can't go: a file banner (DC-FR-08's look),
 * a limit banner (DC-FR-53), a reload (the post moved on), a short failure
 * line, or nothing (the creator cancelled).
 */
export type UploadProblem =
  | { show: "file"; heading: string; body: string }
  | { show: "limit"; post: boolean; heading: string; body: string }
  | { show: "reload" }
  | { show: "failed"; message: string }
  | { show: "nothing" };

const tooBig = (fileName: string, size?: number): UploadProblem => ({
  show: "file",
  heading: "This file is over 1 GB.",
  body: `${size ? `${fileName} is ${(size / 1024 ** 3).toFixed(1)} GB. ` : ""}Export a smaller file and upload it again. Nothing was sent.`,
});
const tooLong = (fileName: string, length?: { lengthSec: number; lengthCapSec: number }): UploadProblem => ({
  show: "file",
  heading: `We couldn’t check ${fileName}`,
  body: length ? `${fileName} is ${formatDuration(length.lengthSec)} long, and drafts can be up to ${formatDuration(length.lengthCapSec)}.` : `${fileName} is longer than drafts can be.`,
});
const format = (fileName: string): UploadProblem => ({ show: "file", heading: `We couldn’t check ${fileName}`, body: `We can’t check ${fileName} in this format. Upload an MP4 or MOV.` });

/**
 * A file the browser checked and stopped before sending.
 *
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18), DC-FR-08
 */
export function fromCheck(p: DraftFileProblem, fileName: string): UploadProblem {
  if (p.kind === "too_big") return tooBig(fileName, p.size);
  if (p.kind === "too_long") return tooLong(fileName, p);
  return format(fileName);
}

/**
 * The API's answer to an upload that didn't go: its file refusals read as the
 * browser's own checks, its limits as DC-FR-53.
 *
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18), DC-FR-53
 */
export function fromAnswer(r: Extract<ApiResult<unknown>, { ok: false }>, fileName: string): UploadProblem {
  if (r.error === "cancelled") return { show: "nothing" };
  if (r.error === "draft_limit" && r.limit) {
    if (r.limit.field === "post")
      return { show: "limit", post: true, heading: "This post has had all the checks one post can have.", body: "So this draft can’t be checked. Your last results stay as they are." };
    const when = r.limit.resetsAt ? `from ${new Date(r.limit.resetsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}` : "tomorrow";
    return { show: "limit", post: false, heading: "Cleared has checked all the video it can today.", body: `You can upload this draft ${when}.` };
  }
  if (r.error === "rejected") {
    switch (r.code) {
      case "file_too_large":
        return tooBig(fileName);
      case "file_too_long":
        return tooLong(fileName, r.file);
      case "file_format":
        return format(fileName);
      case "file_unreadable":
        return { show: "file", heading: `We couldn’t check ${fileName}`, body: `We couldn’t read ${fileName}; the file may be damaged.` };
      // not_held, released, approved, check_running: the post moved on; show it as it is now.
      default:
        return { show: "reload" };
    }
  }
  return { show: "failed", message: "We couldn’t send your draft. Try again." };
}
