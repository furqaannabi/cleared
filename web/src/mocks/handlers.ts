import type { RequestHandler } from "msw";

/**
 * Provisional mock handlers for the Cleared API, shared by development,
 * Vitest and Playwright. Empty until the first feature needs an endpoint;
 * each handler follows the provisional shapes in its FRD and is listed for
 * Furqaan in that FRD's "Requests for Furqaan" section.
 *
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export const handlers: RequestHandler[] = [];
