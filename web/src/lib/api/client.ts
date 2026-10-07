import type { z } from "zod";
import { dealDraftSchema, dealsSchema, deliverableSchema, draftSchema } from "./schemas";

/** `rejected`: the API refused a change (the item changed, say); the others are as for reads. */
export type ApiError = "not_found" | "invalid_response" | "unavailable" | "rejected";
type DraftPlatform = "youtube_video" | "youtube_short" | "instagram_reel";
type DraftItemKind = "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";

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
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<ApiResult<z.infer<S>>> {
    let res: Response;
    try {
      // The session lives in an HttpOnly cookie, never in script-readable storage.
      res = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { ok: false, error: "unavailable" };
    }
    // DC-FR-38: a deal that doesn't exist and one that isn't yours look the same.
    if (res.status === 404 || res.status === 403) return { ok: false, error: "not_found" };
    if (res.status === 400 || res.status === 409 || res.status === 422) return { ok: false, error: "rejected" };
    if (!res.ok) return { ok: false, error: "unavailable" };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, error: "invalid_response" };
    }
    const parsed = schema.safeParse(json);
    // A response that breaks its schema is an error, never shown in part.
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "invalid_response" };
  }

  const deliverablePath = (id: string) => `/deliverables/${encodeURIComponent(id)}`;
  const dealPath = (id: string) => `/deals/${encodeURIComponent(id)}`;
  const questionPath = (dealId: string, qid: string) => `${dealPath(dealId)}/questions/${encodeURIComponent(qid)}`;
  const itemPath = (dealId: string, itemId: string) => `${dealPath(dealId)}/items/${encodeURIComponent(itemId)}`;
  const askPath = (deliverableId: string, itemId: string) =>
    `${deliverablePath(deliverableId)}/items/${encodeURIComponent(itemId)}/ask`;

  return {
    /** DC-FR-31: the creator's deals, each with the deliverable to open (DC-FR-37). */
    getDeals: () => request("GET", "/deals", dealsSchema),
    /** DC-FR-01: one deliverable for the draft check page. */
    getDeliverable: (deliverableId: string) => request("GET", deliverablePath(deliverableId), deliverableSchema),
    /** DC-FR-14: ask the brand to accept an Unsure item. Returns the updated deliverable. */
    askBrandToAccept: (deliverableId: string, itemId: string) =>
      request("POST", askPath(deliverableId, itemId), deliverableSchema),
    /** DC-FR-26: a fresh short-lived link to the draft, when the current one has expired. */
    refreshDraftUrl: (deliverableId: string) =>
      request("POST", `${deliverablePath(deliverableId)}/draft-url`, draftSchema),
    /** DC-FR-09: retry a check that failed on our side. Returns the updated deliverable. */
    retryCheck: (deliverableId: string) =>
      request("POST", `${deliverablePath(deliverableId)}/check/retry`, deliverableSchema),
    /** DC-FR-15: withdraw an ask. Returns the updated deliverable. */
    withdrawAsk: (deliverableId: string, itemId: string) =>
      request("DELETE", askPath(deliverableId, itemId), deliverableSchema),

    // Creator brief → checklist (BC FRD). Each returns the whole deal draft.
    /** BC-FR-03: start a deal with its brand and deliverables. */
    createDeal: (input: { brandName: string; deliverables: { platform: DraftPlatform }[] }) =>
      request("POST", "/deals", dealDraftSchema, input),
    /** BC-FR-07: the deal draft, with the reading's progress, items and questions. */
    getDealDraft: (dealId: string) => request("GET", dealPath(dealId), dealDraftSchema),
    /** BC-FR-04: send the pasted brief; reading starts. */
    submitBrief: (dealId: string, text: string) => request("POST", `${dealPath(dealId)}/brief`, dealDraftSchema, { text }),
    /** BC-FR-13: answer a question with a suggestion, own words, or leave the line out. */
    answerQuestion: (dealId: string, questionId: string, answer: { kind: "suggestion" | "own_words" | "left_out"; text?: string }) =>
      request("PUT", questionPath(dealId, questionId), dealDraftSchema, answer),
    /** BC-FR-13: reopen an answered question. */
    reopenQuestion: (dealId: string, questionId: string) => request("DELETE", questionPath(dealId, questionId), dealDraftSchema),
    /** BC-FR-14: change an item's wording. */
    renameItem: (dealId: string, itemId: string, name: string) => request("PATCH", itemPath(dealId, itemId), dealDraftSchema, { name }),
    /** BC-FR-14: remove an item. */
    removeItem: (dealId: string, itemId: string) => request("DELETE", itemPath(dealId, itemId), dealDraftSchema),
    /** BC-FR-14: copy an item to another deliverable. */
    copyItem: (dealId: string, itemId: string, deliverableId: string) =>
      request("POST", `${itemPath(dealId, itemId)}/copy`, dealDraftSchema, { deliverableId }),
    /** BC-FR-14: move an item to another deliverable. */
    moveItem: (dealId: string, itemId: string, deliverableId: string) =>
      request("POST", `${itemPath(dealId, itemId)}/move`, dealDraftSchema, { deliverableId }),
    /** BC-FR-15: add an item the brief doesn't mention. */
    addItem: (dealId: string, item: { deliverableId: string; name: string; kind: DraftItemKind }) =>
      request("POST", `${dealPath(dealId)}/items`, dealDraftSchema, item),
    /** BC-FR-16: the creator agrees the checklist; the deal moves to the invite step. */
    markChecklistReady: (dealId: string) => request("POST", `${dealPath(dealId)}/checklist/ready`, dealDraftSchema),
  };
}
