"use client";

import { useCallback, useState } from "react";
import type { ApiResult } from "@/lib/api";
import { cancelFailure } from "@/lib/cancel/cancel-failure";

/** Sends one cancel with its optional note. */
export type CancelSend<T> = (note?: string) => Promise<ApiResult<T>>;

/**
 * Sends a cancel and handles what comes back: the cancelled post; a refusal,
 * after which the post is read again and the reason shown (CN-FR-09); or a
 * failed request, which keeps the card open to try again (CN-FR-08). Never
 * retries on its own (CN-BR-03).
 *
 * @see docs/specs/cancel-frd.md CN-FR-08, CN-FR-09, CN-FR-19
 */
export function useCancelPost<T extends { cancelled?: unknown }>({
  send,
  reload,
  onUpdated,
  onDone,
  side,
  creatorName,
}: {
  side: "creator" | "brand";
  creatorName?: string;
  send: CancelSend<T>;
  reload: () => Promise<T | null>;
  onUpdated: (d: T) => void;
  onDone: () => void;
}) {
  const [sending, setSending] = useState(false);
  // CN-FR-08, CN-FR-19: why the request didn't go through; the card and the note stay.
  const [failed, setFailed] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const run = useCallback(
    async (note: string) => {
      setSending(true);
      setFailed(null);
      const r = await send(note.trim() || undefined);
      if (r.ok) {
        onUpdated(r.data);
        setAnnouncement("Cancelled.");
        onDone();
      } else if (r.error === "rejected") {
        // Things changed; show the post as it is now, and why.
        const fresh = await reload();
        if (fresh) onUpdated(fresh);
        const why = fresh?.cancelled ? "This post was already cancelled." : null;
        setRefusal(why);
        setAnnouncement(`Not cancelled. ${why ?? "This post can’t be cancelled now."}`);
        onDone();
      } else {
        setFailed(cancelFailure(r.error, side, creatorName));
      }
      setSending(false);
    },
    [send, reload, onUpdated, onDone, side, creatorName],
  );

  const reset = useCallback(() => {
    setFailed(null);
    setRefusal(null);
  }, []);

  return { run, reset, sending, failed, refusal, announcement };
}
