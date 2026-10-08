import type { z } from "zod";
import { brandDealSchema, brandDeliverableSchema, brandSessionSchema, holdStartSchema, creatorProfileSchema, dealDraftSchema, dealInviteSchema, dealsSchema, deliverableSchema, draftSchema } from "./schemas";

/** `rejected`: the API refused a change (the item changed, say); the others are as for reads. */
export type ApiError = "not_found" | "invalid_response" | "unavailable" | "rejected";
type BrandNoteAbout = z.infer<typeof brandDealSchema>["notes"][number]["about"];
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
  const invitePath = (id: string) => `${dealPath(id)}/invite`;
  const holdPath = (dealId: string, deliverableId: string) => `/brand${dealPath(dealId)}/posts/${encodeURIComponent(deliverableId)}/hold`;
  const brandDeliverablePath = (dealId: string, deliverableId: string) => `/brand${dealPath(dealId)}/deliverables/${encodeURIComponent(deliverableId)}`;
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
    /** PP-FR-01 to PP-FR-05: ask for the go-ahead to post; the API re-confirms the hold and answers. */
    getGoAhead: (deliverableId: string) => request("POST", `${deliverablePath(deliverableId)}/go-ahead`, deliverableSchema),
    /** PP-FR-06, PP-FR-07: "I've posted it"; a Reel gives its link. Starts the live check. */
    markPosted: (deliverableId: string, url?: string) =>
      request("POST", `${deliverablePath(deliverableId)}/posted`, deliverableSchema, url ? { url } : {}),
    /** PP-FR-12: check the live post again, within the fix window. */
    checkLiveAgain: (deliverableId: string) => request("POST", `${deliverablePath(deliverableId)}/live-check/again`, deliverableSchema),
    /** PP-FR-19, PP-FR-20: send a payout that didn't pay again. */
    sendPayoutAgain: (deliverableId: string) => request("POST", `${deliverablePath(deliverableId)}/payout/again`, deliverableSchema),
    /** DC-FR-15: withdraw an ask. Returns the updated deliverable. */
    withdrawAsk: (deliverableId: string, itemId: string) =>
      request("DELETE", askPath(deliverableId, itemId), deliverableSchema),

    // Creator brief → checklist (BC FRD). Each returns the whole deal draft.
    /** BC-FR-03: start a deal with its brand and deliverables. */
    createDeal: (input: { brandName: string; deliverables: { platform: DraftPlatform }[] }) =>
      request("POST", "/deals", dealDraftSchema, input),
    /** BC-FR-23: change the brand and posts before the brief is sent; a post with an id keeps it. */
    updateDeal: (dealId: string, input: { brandName: string; deliverables: { id?: string; platform: DraftPlatform }[] }) =>
      request("PATCH", dealPath(dealId), dealDraftSchema, input),
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
    /** IN-FR-03: back to the checklist step before the link exists; the invite terms are kept. */
    reopenChecklist: (dealId: string) => request("POST", `${dealPath(dealId)}/checklist/reopen`, dealDraftSchema),

    // Creator invite (IN FRD). Each deal call returns the whole invite.
    /** IN-FR-04: the deal's invite terms and link. */
    getInvite: (dealId: string) => request("GET", invitePath(dealId), dealInviteSchema),
    /** IN-FR-05, IN-FR-07, IN-FR-15: save one post's amount (a two-place decimal string) and/or deadline in days. */
    updateInvitePost: (dealId: string, deliverableId: string, terms: { amount?: string; deadlineDays?: number }) =>
      request("PATCH", `${invitePath(dealId)}/posts/${encodeURIComponent(deliverableId)}`, dealInviteSchema, terms),
    /** IN-FR-13: the brand's email, or null to clear it. */
    updateInvite: (dealId: string, terms: { brandEmail: string | null }) => request("PATCH", invitePath(dealId), dealInviteSchema, terms),
    /** IN-FR-17: lock the terms and create the brand's link. */
    createInviteLink: (dealId: string) => request("POST", `${invitePath(dealId)}/link`, dealInviteSchema),
    /** IN-FR-18: turn the link off and make a new one. */
    renewInviteLink: (dealId: string) => request("POST", `${invitePath(dealId)}/link/renew`, dealInviteSchema),
    /** IN-FR-19: turn the link off and reopen the terms for editing. */
    turnOffInviteLink: (dealId: string) => request("DELETE", `${invitePath(dealId)}/link`, dealInviteSchema),
    /** CH-FR-23: the creator's reply to one of the brand's notes; plain text. */
    replyToNote: (dealId: string, noteId: string, reply: string) =>
      request("PUT", `${dealPath(dealId)}/notes/${encodeURIComponent(noteId)}/reply`, dealInviteSchema, { reply }),
    /** CH-FR-24: send the updated terms to the brand's same link, as a new version. */
    sendUpdatedTerms: (dealId: string) => request("POST", `${invitePath(dealId)}/send`, dealInviteSchema),

    /** IN-FR-10, IN-FR-12: the creator's name, PayPal email and connected accounts. */
    getProfile: () => request("GET", "/me", creatorProfileSchema),
    /** IN-FR-12: save the PayPal email payments go to. */
    setPaypalEmail: (email: string) => request("PUT", "/me/paypal-email", creatorProfileSchema, { email }),
    /** IN-FR-11: connect an account. Provisional: the real flow is a sign-in redirect (Requests for Furqaan). */
    connectAccount: (platform: "youtube" | "instagram") => request("POST", `/me/accounts/${platform}`, creatorProfileSchema),

    // Confirm and hold, the brand's side (CH FRD). The session is an HttpOnly cookie set by the API.
    /** CH-FR-01: swap a link's token for a session scoped to its deal. The token is never stored or logged (CH-BR-06). */
    openBrandLink: (token: string) => request("POST", `/b/${encodeURIComponent(token)}/session`, brandSessionSchema),
    /** CH-FR-04 to CH-FR-09: the deal as the brand sees it. */
    getBrandDeal: (dealId: string) => request("GET", `/brand${dealPath(dealId)}`, brandDealSchema),
    /** RW-FR-05 to RW-FR-10: one post's review, as the brand sees it. */
    getBrandDeliverable: (dealId: string, deliverableId: string) =>
      request("GET", brandDeliverablePath(dealId, deliverableId), brandDeliverableSchema),
    /** RW-FR-13: accept an item the creator asked about. */
    acceptItem: (dealId: string, deliverableId: string, itemId: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/items/${encodeURIComponent(itemId)}/accept`, brandDeliverableSchema),
    /** PP-FR-27: confirm a post the live check couldn't decide; the money is taken. */
    confirmPost: (dealId: string, deliverableId: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/post/confirm`, brandDeliverableSchema),
    /** PP-FR-27: object to a live post, with a plain-text reason; a person at Cleared decides. */
    objectToPost: (dealId: string, deliverableId: string, reason: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/post/object`, brandDeliverableSchema, { reason }),
    /** CN-FR-04 to CN-FR-10: the creator cancels one post, with an optional plain-text note for the brand. */
    cancelDeliverable: (deliverableId: string, note?: string) =>
      request("POST", `/deliverables/${encodeURIComponent(deliverableId)}/cancel`, deliverableSchema, note?.trim() ? { note } : {}),
    /** CN-FR-04 to CN-FR-10: the brand cancels one post in its deal, with an optional plain-text note for the creator. */
    cancelBrandDeliverable: (dealId: string, deliverableId: string, note?: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/cancel`, brandDeliverableSchema, note?.trim() ? { note } : {}),
    /** CN-FR-01, CN-FR-02, CN-FR-14: the creator cancels a post from the invite page, held or not; answers with the invite. */
    cancelInvitePost: (dealId: string, deliverableId: string, note?: string) =>
      request("POST", `${invitePath(dealId)}/posts/${encodeURIComponent(deliverableId)}/cancel`, dealInviteSchema, note?.trim() ? { note } : {}),
    /** CN-FR-01, CN-FR-02, CN-FR-15: the brand cancels a post from its deal page, held or not; answers with the deal. */
    cancelBrandDealPost: (dealId: string, deliverableId: string, note?: string) =>
      request("POST", `/brand${dealPath(dealId)}/posts/${encodeURIComponent(deliverableId)}/cancel`, brandDealSchema, note?.trim() ? { note } : {}),
    /** PP-FR-28: accept a post that failed the live check anyway; the money is taken. */
    acceptPost: (dealId: string, deliverableId: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/post/accept`, brandDeliverableSchema),
    /** RW-FR-16, RW-FR-21: approve the draft, in the window or after objecting. */
    approveDraft: (dealId: string, deliverableId: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/approve`, brandDeliverableSchema),
    /** RW-FR-17, RW-FR-18: send the brand's objections together, each naming one passed item with a plain-text note. */
    sendObjections: (dealId: string, deliverableId: string, objections: { itemId: string; note: string }[]) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/objections`, brandDeliverableSchema, { objections }),
    /** RW-FR-14: ask the creator to fix an item they asked about, with an optional plain-text note. */
    askToFix: (dealId: string, deliverableId: string, itemId: string, note?: string) =>
      request("POST", `${brandDeliverablePath(dealId, deliverableId)}/items/${encodeURIComponent(itemId)}/fix`, brandDeliverableSchema, note ? { note } : {}),
    /** CH-FR-11, CH-FR-12: send the brand's notes together; the deal moves to `changes_requested`. Notes are plain text (CH-BR-07). */
    sendChanges: (dealId: string, notes: { about: BrandNoteAbout; text: string }[]) =>
      request("POST", `/brand${dealPath(dealId)}/notes`, brandDealSchema, { notes }),
    /** CH-FR-14, CH-FR-15: agree to the version shown; the API refuses one that's out of date (CH-BR-02). */
    agree: (dealId: string, version: number) => request("POST", `/brand${dealPath(dealId)}/agree`, brandDealSchema, { version }),
    /** CH-FR-17: start one post's hold; returns the PayPal order its approval needs. The page never moves money itself (CH-BR-05). */
    startHold: (dealId: string, deliverableId: string) => request("POST", holdPath(dealId, deliverableId), holdStartSchema),
    /** CH-FR-18: PayPal approved the order; the API authorizes it and reports the hold's state. */
    confirmHold: (dealId: string, deliverableId: string, orderId: string) =>
      request("POST", `${holdPath(dealId, deliverableId)}/approved`, brandDealSchema, { orderId }),
    /** CH-FR-18: the brand closed PayPal without approving; nothing was held. */
    cancelHold: (dealId: string, deliverableId: string, orderId: string) =>
      request("POST", `${holdPath(dealId, deliverableId)}/closed`, brandDealSchema, { orderId }),
  };
}
