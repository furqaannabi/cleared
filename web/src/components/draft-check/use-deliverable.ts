"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";

export type DeliverableLoad =
  | { status: "loading" }
  | { status: "ready"; deliverable: Deliverable }
  | { status: "error"; error: ApiError };

/**
 * Loads one deliverable through the API client and exposes a retry.
 *
 * @param deliverableId - the deliverable's opaque id from the route
 * @returns the load state and a function to load again
 * @see docs/specs/creator-draft-check-frd.md DC-FR-01, DC-FR-39
 */
export function useDeliverable(deliverableId: string): { load: DeliverableLoad; retry: () => void } {
  const [load, setLoad] = useState<DeliverableLoad>({ status: "loading" });
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

  return { load, retry };
}
