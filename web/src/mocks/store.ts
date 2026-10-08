import type { Deliverable } from "@/lib/deliverable/types";
import { resetBrandDeals } from "./brand-deals";
import { resetDealDrafts } from "./deal-drafts";
import { deliverables } from "./fixtures/deliverables";
import { resetInvites } from "./invites";

/*
 * An in-memory copy of the synthetic fixtures, so mocked changes (asking the
 * brand, withdrawing) persist for a session. Tests reset it after each test.
 */
let data: Record<string, Deliverable> = structuredClone(deliverables);

/** One mock deliverable, or undefined. */
export const findDeliverable = (id: string) => data[id];

/** The mock deliverables, for keeping the mock data in the browser. */
export const deliverablesData = { get: () => data, set: (d: Record<string, Deliverable>) => void (data = d) };

/** Adds a deliverable, as when every hold on a deal is in (CH-FR-21). */
export function addDeliverable(d: Deliverable) {
  data[d.id] = structuredClone(d);
}

/** Restores every mock deliverable to its fixture. */
export function resetMockData() {
  data = structuredClone(deliverables);
  resetDealDrafts();
  resetInvites();
  resetBrandDeals();
}
