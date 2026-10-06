import type { z } from "zod";
import { deliverableSchema } from "./schemas";

export type ApiError = "not_found" | "invalid_response" | "unavailable";
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
  async function get<S extends z.ZodType>(path: string, schema: S): Promise<ApiResult<z.infer<S>>> {
    let res: Response;
    try {
      // The session lives in an HttpOnly cookie, never in script-readable storage.
      res = await fetch(`${baseUrl}${path}`, { credentials: "include", headers: { Accept: "application/json" } });
    } catch {
      return { ok: false, error: "unavailable" };
    }
    // DC-FR-38: a deal that doesn't exist and one that isn't yours look the same.
    if (res.status === 404 || res.status === 403) return { ok: false, error: "not_found" };
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

  return {
    /** DC-FR-01: one deliverable for the draft check page. */
    getDeliverable: (deliverableId: string) =>
      get(`/deliverables/${encodeURIComponent(deliverableId)}`, deliverableSchema),
  };
}
