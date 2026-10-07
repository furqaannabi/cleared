import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { deals } from "./fixtures/deals";
import { findDeliverable } from "./store";

/**
 * Provisional mock handlers for the Cleared API, shared by development,
 * Vitest and Playwright. Paths follow the creator draft check FRD's
 * "Requests for Furqaan"; shapes follow its provisional contract.
 *
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export const handlers: RequestHandler[] = [
  // DC-FR-31, DC-FR-37
  http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json(deals)),

  // DC-FR-01, DC-FR-38
  http.get(`${apiBaseUrl}/deliverables/:deliverableId`, ({ params }) => {
    const found = findDeliverable(String(params.deliverableId));
    return found ? HttpResponse.json(found) : notFound();
  }),

  // DC-FR-26: the mock's link never really expires, so it hands back the same one.
  http.post(`${apiBaseUrl}/deliverables/:deliverableId/draft-url`, ({ params }) => {
    const d = findDeliverable(String(params.deliverableId));
    return d?.draft ? HttpResponse.json(d.draft) : notFound();
  }),

  // DC-FR-09: retrying restarts the check; draft-check items go back to Checking.
  http.post(`${apiBaseUrl}/deliverables/:deliverableId/check/retry`, ({ params }) => {
    const d = findDeliverable(String(params.deliverableId));
    if (!d) return notFound();
    if (d.state !== "check_failed" || d.checkFailure?.kind !== "ours") return refused();
    d.state = "checking";
    d.checkFailure = undefined;
    for (const item of d.items) {
      if (item.status !== "at_live_check") Object.assign(item, { previousStatus: item.status, status: "checking" });
    }
    return HttpResponse.json(d);
  }),

  // DC-FR-14: only an askable Unsure item that wasn't declined can be asked about.
  http.post(`${apiBaseUrl}/deliverables/:deliverableId/items/:itemId/ask`, ({ params }) => {
    const d = findDeliverable(String(params.deliverableId));
    const item = d?.items.find((i) => i.id === params.itemId);
    if (!d || !item) return notFound();
    if (d.state === "released" || item.status !== "unsure" || !item.askable || item.declined) return refused();
    Object.assign(item, { status: "waiting_for_brand", askedAt: new Date().toISOString(), askable: false });
    return HttpResponse.json(d);
  }),

  // DC-FR-15: withdrawing returns a waiting item to Unsure.
  http.delete(`${apiBaseUrl}/deliverables/:deliverableId/items/:itemId/ask`, ({ params }) => {
    const d = findDeliverable(String(params.deliverableId));
    const item = d?.items.find((i) => i.id === params.itemId);
    if (!d || !item) return notFound();
    if (item.status !== "waiting_for_brand") return refused();
    Object.assign(item, { status: "unsure", askedAt: undefined, askable: true });
    return HttpResponse.json(d);
  }),
];

function notFound() {
  return HttpResponse.json({ message: "Not found" }, { status: 404 });
}

function refused() {
  return HttpResponse.json({ message: "That change isn't allowed for this item now" }, { status: 409 });
}
