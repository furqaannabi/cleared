import type { Deliverable } from "@/lib/deliverable/types";
import { resetBrandDeals } from "./brand-deals";
import { resetDealDrafts } from "./deal-drafts";
import { deliverables } from "./fixtures/deliverables";
import { juniperDeliverables } from "./fixtures/juniper";
import { resetInvites } from "./invites";

/*
 * An in-memory copy of the synthetic fixtures, so mocked changes (asking the
 * brand, withdrawing) persist for a session. Tests reset it after each test.
 */
const seed = (): Record<string, Deliverable> => ({
  ...structuredClone(deliverables),
  ...Object.fromEntries(juniperDeliverables(Date.now()).map((d) => [d.id, d])),
});
let data: Record<string, Deliverable> = seed();

/**
 * One mock deliverable, or undefined. A review window that has run out with
 * no objection is approved first, as the backend's timer would (RW-BR-01).
 */
export function findDeliverable(id: string): Deliverable | undefined {
  const d = data[id];
  if (d?.state === "fully_passing" && d.reviewWindowEndsAt && Date.parse(d.reviewWindowEndsAt) <= Date.now()) {
    Object.assign(d, { state: "approved", approvedAt: d.reviewWindowEndsAt, approvedBy: "window", reviewWindowEndsAt: undefined });
  }
  return d;
}

/** The mock deliverables, for keeping the mock data in the browser. */
export const deliverablesData = { get: () => data, set: (d: Record<string, Deliverable>) => void (data = d) };

/** Adds a deliverable, as when every hold on a deal is in (CH-FR-21). */
export function addDeliverable(d: Deliverable) {
  data[d.id] = structuredClone(d);
}

/** Restores every mock deliverable to its fixture. */
export function resetMockData() {
  data = seed();
  resetDealDrafts();
  resetInvites();
  resetBrandDeals();
}
