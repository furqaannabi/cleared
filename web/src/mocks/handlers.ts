import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { deliverables } from "./fixtures/deliverables";

/**
 * Provisional mock handlers for the Cleared API, shared by development,
 * Vitest and Playwright. Paths follow the creator draft check FRD's
 * "Requests for Furqaan"; shapes follow its provisional contract.
 *
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export const handlers: RequestHandler[] = [
  // DC-FR-01, DC-FR-38
  http.get(`${apiBaseUrl}/deliverables/:deliverableId`, ({ params }) => {
    const found = deliverables[String(params.deliverableId)];
    return found ? HttpResponse.json(found) : HttpResponse.json({ message: "Not found" }, { status: 404 });
  }),
];
