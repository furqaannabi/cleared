import type { Deliverable } from "@/lib/deliverable/types";
import { resetCancel } from "./cancel";
import { resetBrandDeals } from "./brand-deals";
import { resetDealDrafts } from "./deal-drafts";
import { deliverables } from "./fixtures/deliverables";
import { juniperDeliverables } from "./fixtures/juniper";
import { settle } from "./publish-settle";
import { resetInvites } from "./invites";
import { resetPublish } from "./publish";

/*
 * An in-memory copy of the synthetic fixtures, so mocked changes (asking the
 * brand, withdrawing) persist for a session. Tests reset it after each test.
 */
const seed = (): Record<string, Deliverable> => {
  const now = Date.now();
  const data = structuredClone(deliverables);
  // DC-FR-07: the Northbound Short's review window is open whenever the demo starts, not until a fixed date.
  data.del_nb_short.reviewWindowEndsAt = new Date(now + 31 * 3_600_000).toISOString();
  return { ...data, ...Object.fromEntries(juniperDeliverables(now).map((d) => [d.id, d])) };
};
let data: Record<string, Deliverable> = seed();

/**
 * One mock deliverable, or undefined. Whatever the clock has made due is
 * applied first, as the backend's timers would: a review window that ran out
 * with no objection is approved (RW-BR-01), and the steps after it (PP FRD).
 */
export function findDeliverable(id: string): Deliverable | undefined {
  const d = data[id];
  if (d?.state === "fully_passing" && d.reviewWindowEndsAt && Date.parse(d.reviewWindowEndsAt) <= Date.now()) {
    Object.assign(d, { state: "approved", approvedAt: d.reviewWindowEndsAt, approvedBy: "window", reviewWindowEndsAt: undefined });
  }
  // PP FRD: the go-ahead, live check, brand's 48 hours and payout, as the backend's timers would.
  if (d) settle(d, Date.now());
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
  resetPublish();
  resetCancel();
}
