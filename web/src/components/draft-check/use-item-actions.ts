"use client";

import { useCallback, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";

const PROBLEM: Record<ApiError, string> = {
  rejected: "This item has changed. Reload the page to see its latest result.",
  not_found: "We couldn’t find this deal any more.",
  unavailable: "We couldn’t send that. Try again.",
  invalid_response: "We couldn’t send that. Try again.",
};

/**
 * Asks the brand to accept an item, or withdraws an ask, and hands the
 * updated deliverable back. Tracks which item is in flight so its button
 * can't be pressed twice, the last problem in plain words, and a line for
 * screen readers saying what was done.
 *
 * @param deliverableId - the deliverable the items belong to
 * @param brandName - the deal's brand, for the announcement
 * @param onUpdated - called with the deliverable the API returns
 * @see docs/specs/creator-draft-check-frd.md DC-FR-14, DC-FR-15
 */
export function useItemActions(deliverableId: string, brandName: string, onUpdated: (d: Deliverable) => void) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ itemId: string; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const run = useCallback(
    async (itemId: string, call: typeof api.askBrandToAccept, done: string) => {
      setPendingId(itemId);
      setProblem(null);
      const result = await call(deliverableId, itemId);
      setPendingId(null);
      if (result.ok) {
        onUpdated(result.data);
        setAnnouncement(done);
      } else setProblem({ itemId, text: PROBLEM[result.error] });
    },
    [deliverableId, onUpdated],
  );

  return {
    ask: (item: { id: string; name: string }) => run(item.id, api.askBrandToAccept, `Asked ${brandName} to accept “${item.name}”.`),
    withdraw: (item: { id: string; name: string }) => run(item.id, api.withdrawAsk, `Withdrew your ask for “${item.name}”.`),
    announcement,
    pendingId,
    problemFor: (itemId: string) => (problem?.itemId === itemId ? problem.text : null),
  };
}
