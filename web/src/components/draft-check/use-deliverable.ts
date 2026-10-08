"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";

export type DeliverableLoad =
  | { status: "loading" }
  // DC-FR-33: another post in the same deal is opening; the one on screen stays until it arrives.
  | { status: "switching"; previous: Deliverable }
  | { status: "ready"; deliverable: Deliverable }
  | { status: "error"; error: ApiError };

/** The post on screen, so a switch within its deal starts from it rather than from empty. */
let onScreen: { dealId: string; deliverable: Deliverable } | null = null;

/**
 * Loads one deliverable through the API client and exposes a retry. Opening
 * another post in the same deal starts as `switching`, with the post on
 * screen, rather than `loading`.
 *
 * @param deliverableId - the deliverable's opaque id from the route
 * @param dealId - its deal
 * @returns the load state, a function to load again, and one to show an updated deliverable
 * @see docs/specs/creator-draft-check-frd.md DC-FR-01, DC-FR-39
 */
export function useDeliverable(
  deliverableId: string,
  dealId: string,
): {
  load: DeliverableLoad;
  retry: () => void;
  replace: (deliverable: Deliverable) => void;
} {
  const [load, setLoad] = useState<DeliverableLoad>(() =>
    onScreen && onScreen.dealId === dealId && onScreen.deliverable.id !== deliverableId
      ? { status: "switching", previous: onScreen.deliverable }
      : { status: "loading" },
  );

  // What's on screen, for the next switch; forgotten when the page closes.
  useEffect(() => {
    if (load.status !== "ready") return;
    const shown = { dealId, deliverable: load.deliverable };
    onScreen = shown;
    return () => {
      if (onScreen === shown) onScreen = null;
    };
  }, [load, dealId]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api.getDeliverable(deliverableId).then((result) => {
      if (!current) return;
      setLoad(result.ok ? { status: "ready", deliverable: result.data } : { status: "error", error: result.error });
    });
    return () => {
      current = false;
    };
  }, [deliverableId, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  // After a change (an ask, say), the API returns the whole deliverable; show that.
  const replace = useCallback((deliverable: Deliverable) => setLoad({ status: "ready", deliverable }), []);

  return { load, retry, replace };
}
