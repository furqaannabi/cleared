"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { checkDraftFile, readVideoLength } from "@/lib/draft/check-draft-file";
import { fromAnswer, fromCheck, type UploadProblem } from "@/lib/draft/upload-problem";
import type { Deliverable } from "@/lib/deliverable/types";

/** A draft on its way up: its name, size and how far it has got. */
export type Uploading = { fileName: string; size: number; percent: number };

/**
 * Sends a draft (DC-FR-45, 1.18): checks the file in the browser first, then
 * uploads it with its progress and Cancel, asks before the page is left
 * mid-upload, and once the API has it reads the post back (now Checking).
 * A file, limit or other problem is kept for the page to show (DC-FR-53).
 *
 * @param deliverableId - the post
 * @param onUpdated - takes the post as the API now has it
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45, DC-FR-53
 */
export function useDraftUpload(deliverableId: string, onUpdated: (d: Deliverable) => void) {
  const [uploading, setUploading] = useState<Uploading | null>(null);
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const stop = useRef<AbortController | null>(null);

  // "Your draft is still uploading": the browser asks before the page is left.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);
  useEffect(() => () => stop.current?.abort(), []);

  const reload = useCallback(async () => {
    const r = await api.getDeliverable(deliverableId);
    if (r.ok) onUpdated(r.data);
  }, [deliverableId, onUpdated]);

  const upload = useCallback(
    async (file: File) => {
      setProblem(null);
      const checked = checkDraftFile(file, await readVideoLength(file));
      if (!checked.ok) return setProblem(fromCheck(checked.problem, file.name));
      const controller = new AbortController();
      stop.current = controller;
      setUploading({ fileName: file.name, size: file.size, percent: 0 });
      const r = await api.uploadDraft(deliverableId, file, {
        signal: controller.signal,
        onProgress: (percent) => setUploading((u) => u && { ...u, percent }),
      });
      stop.current = null;
      setUploading(null);
      if (r.ok) return reload();
      const p = fromAnswer(r, file.name);
      if (p.show === "reload") return reload();
      if (p.show !== "nothing") setProblem(p);
    },
    [deliverableId, reload],
  );

  return { upload, uploading, problem, cancel: () => stop.current?.abort() };
}
