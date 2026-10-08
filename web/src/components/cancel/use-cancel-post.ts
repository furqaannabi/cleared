"use client";

import { useCallback, useState } from "react";
import type { ApiResult } from "@/lib/api";

/** Sends one cancel with its optional note. */
export type CancelSend<T> = (note?: string) => Promise<ApiResult<T>>;

/**
 * Sends a cancel and handles what comes back: the cancelled post; a refusal,
 * after which the post is read again and the reason shown (CN-FR-09); or a
 * failed request, which keeps the card open to try again (CN-FR-08). Never
 * retries on its own (CN-BR-03).
 *
 * @see docs/specs/cancel-frd.md CN-FR-08, CN-FR-09
 */
export function useCancelPost<T extends { cancelled?: unknown }>({
  send,
  reload,
  onUpdated,
  onDone,
}: {
  send: CancelSend<T>;
  reload: () => Promise<T | null>;
  onUpdated: (d: T) => void;
  onDone: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const run = useCallback(
    async (note: string) => {
      setSending(true);
      setFailed(false);
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
        setFailed(true);
      }
      setSending(false);
    },
    [send, reload, onUpdated, onDone],
  );

  const reset = useCallback(() => {
    setFailed(false);
    setRefusal(null);
  }, []);

  return { run, reset, sending, failed, refusal, announcement };
}
