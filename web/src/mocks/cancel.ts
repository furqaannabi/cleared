import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { brandDealFor, hasBrandSession, postHold } from "./brand-deals";
import { brandDeliverableFor, creatorView } from "./brand-review";
import { dealOfDeliverable, findDraft } from "./deal-drafts";
import { inviteFor } from "./invites";
import { release, type Mocked } from "./publish-settle";
import { findDeliverable } from "./store";

/*
 * Mock only: cancelling a post (CN FRD, following MP-FR-32 to MP-FR-34).
 * Either side can cancel while there is no go-ahead and nothing is
 * published; a held post's hold is released.
 */

const FINISHED: Deliverable["state"][] = ["released", "paid", "captured", "approved_not_paid"];
const NOTE_MAX = 300;

/** CN-FR-03: whether the post can be cancelled now, and if not, why (MP-FR-33). */
export function cancelOf(d: Deliverable): NonNullable<Deliverable["cancel"]> {
  if (d.post || d.state === "published") return d.state === "paid" || d.state === "released" ? { allowed: false, reason: "finished" } : { allowed: false, reason: "published" };
  if (FINISHED.includes(d.state)) return { allowed: false, reason: "finished" };
  if (d.state === "posting" && d.goAhead?.state === "go") return { allowed: false, reason: "go_ahead_running" };
  return { allowed: true };
}

/** CN-FR-07, CN-BR-04: the optional note, trimmed; `false` when it's too long or not text. */
export function cancelNote(body: unknown): string | undefined | false {
  const note = (body as { note?: unknown } | null)?.note;
  if (note === undefined || note === null) return undefined;
  if (typeof note !== "string") return false;
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX) return false;
  return trimmed || undefined;
}

type Cancelled = NonNullable<Deliverable["cancelled"]>;
/** Posts cancelled before they were held: closed, nothing taken (CN-FR-11, MP-FR-34). */
let closed = new Map<string, Cancelled>();

/** The closed posts, for keeping the mock data in the browser. */
export const cancelData = {
  get: () => [...closed.entries()],
  set: (entries: [string, Cancelled][]) => {
    closed = new Map(entries);
  },
};

/** Back to the seed: nothing cancelled before its hold. */
export function resetCancel() {
  closed = new Map();
}

/** Any post's `cancel` and `cancelled`, held or not (CN-FR-03, CN-FR-10, CN-FR-11). */
export function postCancel(deliverableId: string): Pick<Deliverable, "cancel" | "cancelled"> {
  const d = findDeliverable(deliverableId);
  if (d) return { cancel: cancelOf(d), ...(d.cancelled ? { cancelled: d.cancelled } : {}) };
  const c = closed.get(deliverableId);
  if (c) return { cancel: { allowed: false, reason: "finished" }, cancelled: c };
  // CN-FR-05, MP-FR-34: a hold attempt still waiting at PayPal is stopped there too.
  const dealId = dealOfDeliverable(deliverableId);
  const hold = dealId ? postHold.get(dealId, deliverableId)?.state : undefined;
  return { cancel: hold === "pending" || hold === "unknown" ? { allowed: true, holdAttemptWaiting: true } : { allowed: true } };
}

/** Whether every post of the deal is cancelled: the deal reads Cancelled and its link stops working (CN-FR-12, CN-FR-14). */
export function dealCancelled(dealId: string): boolean {
  const posts = findDraft(dealId)?.deliverables ?? [];
  return posts.length > 0 && posts.every((p) => postCancel(p.id).cancelled);
}

/** Cancels any post of a deal for one side; false when it can't be cancelled now. */
function cancelAny(deliverableId: string, by: "creator" | "brand", note: string | undefined): boolean {
  const c = postCancel(deliverableId).cancel;
  if (!c?.allowed) return false;
  const d = findDeliverable(deliverableId) as Mocked | undefined;
  if (d) {
    cancelPost(d, by, note);
    return true;
  }
  const dealId = dealOfDeliverable(deliverableId);
  if (dealId && c.holdAttemptWaiting) postHold.stop(dealId, deliverableId);
  closed.set(deliverableId, { by, at: new Date().toISOString(), ...(note ? { note } : {}) });
  return true;
}

/** Cancels a held post for one side: the hold is released with who, when and the note (CN-FR-10). */
export function cancelPost(d: Mocked, by: "creator" | "brand", note: string | undefined, now = Date.now()) {
  release(d, now, "cancelled");
  d.cancelled = { by, at: new Date(now).toISOString(), ...(note ? { note } : {}) };
}

export const cancelHandlers: RequestHandler[] = [
  // CN-FR-01, CN-FR-02, CN-FR-14: the creator cancels a post from the invite page, held or not; answers with the invite.
  http.post(`${apiBaseUrl}/deals/:dealId/invite/posts/:id/cancel`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const id = String(params.id);
    if (dealOfDeliverable(id) !== dealId) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const note = cancelNote(await request.json().catch(() => ({})));
    if (note === false || !cancelAny(id, "creator", note)) return HttpResponse.json({ message: "Refused" }, { status: 409 });
    return HttpResponse.json(inviteFor(dealId));
  }),
  // CN-FR-01, CN-FR-02, CN-FR-15: the brand cancels a post from its deal page, held or not; answers with the deal.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/posts/:id/cancel`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const id = String(params.id);
    if (!hasBrandSession(dealId) || dealOfDeliverable(id) !== dealId) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const note = cancelNote(await request.json().catch(() => ({})));
    if (note === false || !cancelAny(id, "brand", note)) return HttpResponse.json({ message: "Refused" }, { status: 409 });
    return HttpResponse.json(brandDealFor(dealId));
  }),
  // CN-FR-04 to CN-FR-10: the creator cancels one post.
  http.post(`${apiBaseUrl}/deliverables/:id/cancel`, async ({ params, request }) => {
    const d = findDeliverable(String(params.id)) as Mocked | undefined;
    if (!d) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const note = cancelNote(await request.json().catch(() => ({})));
    if (note === false || !cancelOf(d).allowed) return HttpResponse.json({ message: "Refused" }, { status: 409 });
    cancelPost(d, "creator", note);
    return HttpResponse.json(creatorView(d));
  }),
  // CN-FR-01, CN-FR-04 to CN-FR-10: the brand cancels one post in its deal.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/deliverables/:id/cancel`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const id = String(params.id);
    if (!hasBrandSession(dealId) || dealOfDeliverable(id) !== dealId) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const d = findDeliverable(id) as Mocked | undefined;
    if (!d) return HttpResponse.json({ message: "Not found" }, { status: 404 });
    const note = cancelNote(await request.json().catch(() => ({})));
    if (note === false || !cancelOf(d).allowed) return HttpResponse.json({ message: "Refused" }, { status: 409 });
    cancelPost(d, "brand", note);
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),
];
