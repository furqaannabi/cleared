import type { Deliverable } from "@/lib/deliverable/types";
import { resetDealDrafts } from "./deal-drafts";
import { deliverables } from "./fixtures/deliverables";

/*
 * An in-memory copy of the synthetic fixtures, so mocked changes (asking the
 * brand, withdrawing) persist for a session. Tests reset it after each test.
 */
let data: Record<string, Deliverable> = structuredClone(deliverables);

/** One mock deliverable, or undefined. */
export const findDeliverable = (id: string) => data[id];

/** Restores every mock deliverable to its fixture. */
export function resetMockData() {
  data = structuredClone(deliverables);
  resetDealDrafts();
}
