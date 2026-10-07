import type { z } from "zod";
import { deliverableSchema } from "./schemas";

/** `rejected`: the API refused a change (the item changed, say); the others are as for reads. */
export type ApiError = "not_found" | "invalid_response" | "unavailable" | "rejected";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * The one typed client for the Cleared API. Every response is parsed with
 * its schema before the app sees it. Paths are provisional (creator draft
 * check FRD, "Requests for Furqaan").
 *
 * @param options.baseUrl - the API's base URL
 * @see docs/decisions/2026-10-06-schema-validation-zod.md
 */
export function createApiClient({ baseUrl }: { baseUrl: string }) {
  async function request<S extends z.ZodType>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    schema: S,
  ): Promise<ApiResult<z.infer<S>>> {
    let res: Response;
    try {
      // The session lives in an HttpOnly cookie, never in script-readable storage.
      res = await fetch(`${baseUrl}${path}`, { method, credentials: "include", headers: { Accept: "application/json" } });
    } catch {
      return { ok: false, error: "unavailable" };
    }
    // DC-FR-38: a deal that doesn't exist and one that isn't yours look the same.
    if (res.status === 404 || res.status === 403) return { ok: false, error: "not_found" };
    if (res.status === 400 || res.status === 409 || res.status === 422) return { ok: false, error: "rejected" };
    if (!res.ok) return { ok: false, error: "unavailable" };

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, error: "invalid_response" };
    }
    const parsed = schema.safeParse(body);
    // A response that breaks its schema is an error, never shown in part.
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "invalid_response" };
  }

  const deliverablePath = (id: string) => `/deliverables/${encodeURIComponent(id)}`;
  const askPath = (deliverableId: string, itemId: string) =>
    `${deliverablePath(deliverableId)}/items/${encodeURIComponent(itemId)}/ask`;

  return {
    /** DC-FR-01: one deliverable for the draft check page. */
    getDeliverable: (deliverableId: string) => request("GET", deliverablePath(deliverableId), deliverableSchema),
    /** DC-FR-14: ask the brand to accept an Unsure item. Returns the updated deliverable. */
    askBrandToAccept: (deliverableId: string, itemId: string) =>
      request("POST", askPath(deliverableId, itemId), deliverableSchema),
    /** DC-FR-15: withdraw an ask. Returns the updated deliverable. */
    withdrawAsk: (deliverableId: string, itemId: string) =>
      request("DELETE", askPath(deliverableId, itemId), deliverableSchema),
  };
}
