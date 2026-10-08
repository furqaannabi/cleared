import { http, HttpResponse, type RequestHandler } from "msw";
import type { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import type { brandDeliverableSchema } from "@/lib/api/schemas";
import type { Deliverable } from "@/lib/deliverable/types";
import { hasBrandSession, startBrandSession } from "./brand-deals";
import { dealOfDeliverable, findDraft } from "./deal-drafts";
import { brandEmailFor, postTerms } from "./invites";
import { findDeliverable } from "./store";

type BrandDeliverable = z.infer<typeof brandDeliverableSchema>;
type BrandItem = NonNullable<BrandDeliverable["draft"]>["items"][number];
type Item = Deliverable["items"][number];

/*
 * Mock brand review (RW FRD), the brand's side of step 5. One record per
 * post: the creator's deliverable in the mock store. The brand's view is
 * worked out from it and leaves out what's only for the creator: the fix
 * hint, earlier runs and the run number (RW-BR-06). The window's timer runs
 * here, never in the page (RW-BR-01). Nothing reaches PayPal.
 */

const WINDOW_MS = 48 * 3_600_000;
const NOTE_MAX = 500;

const notFound = () => HttpResponse.json({ message: "Not found" }, { status: 404 });
const refused = () => HttpResponse.json({ message: "Refused" }, { status: 409 });

/** The post, if it belongs to the deal and the brand opened this deal's link. */
function sessionPost(dealId: string, deliverableId: string): Deliverable | undefined {
  if (!hasBrandSession(dealId)) return undefined;
  if (!findDraft(dealId)?.deliverables.some((x) => x.id === deliverableId)) return undefined;
  return findDeliverable(deliverableId);
}

const BRAND_STATUS: Partial<Record<Item["status"], BrandItem["status"]>> = {
  passed: "passed",
  fix_needed: "fix_needed",
  at_live_check: "at_live_check",
  waiting_for_brand: "asked",
  accepted_by_brand: "accepted",
  objected_by_brand: "objected",
};

const brandStatus = (i: Item): BrandItem["status"] =>
  i.status === "unsure" ? (i.declined ? "fix_requested" : "unsure") : (BRAND_STATUS[i.status] ?? "unsure");

/** Whether the creator asked the brand about anything on this run (RW-FR-06). */
const askedThisRun = (d: Deliverable) => d.items.some((i) => i.status === "waiting_for_brand" || i.status === "accepted_by_brand" || i.declined);

function reviewOf(d: Deliverable): BrandDeliverable["review"] {
  switch (d.state) {
    case "released":
      return { state: "released", releasedAt: d.releasedAt ?? new Date().toISOString(), reason: d.releaseReason ?? "deadline" };
    case "approved":
      return { state: "approved", approvedAt: d.approvedAt!, by: d.approvedBy ?? "brand" };
    case "objected":
      return { state: "objected", objectedAt: d.objectedAt! };
    case "fully_passing":
      return { state: "window", endsAt: d.reviewWindowEndsAt! };
    case "results":
      return askedThisRun(d) ? { state: "asked" } : { state: "nothing_yet" };
    default:
      return { state: "nothing_yet" };
  }
}

/**
 * One post as the brand sees it; undefined when the post isn't on the deal.
 *
 * @see docs/specs/brand-review-frd.md RW-FR-05 to RW-FR-10, RW-BR-06
 */
export function brandDeliverableFor(dealId: string, d: Deliverable): BrandDeliverable | undefined {
  const terms = postTerms(dealId)[d.id];
  if (!terms?.amount) return undefined;
  const review = reviewOf(d);
  const showDraft = review.state !== "nothing_yet" && d.draft;
  return structuredClone({
    dealId,
    deliverableId: d.id,
    creatorName: "Ada Okafor",
    brandName: d.brandName,
    platform: d.platform,
    creatorTimeZone: d.creatorTimeZone,
    hold: { amount: terms.amount, reference: d.hold.reference, deadline: d.deadline },
    review,
    ...(showDraft
      ? {
          draft: {
            url: d.draft!.url,
            urlExpiresAt: d.draft!.urlExpiresAt,
            durationSec: d.draft!.durationSec,
            items: d.items.map((i) => ({
              id: i.id,
              name: i.name,
              kind: i.kind,
              checkedBy: i.checkedBy,
              status: brandStatus(i),
              ...(i.briefLine ? { briefLine: i.briefLine } : {}),
              ...(i.evidence ? { evidence: i.evidence } : {}),
              ...(i.brandNote ? { note: i.brandNote } : {}),
            })),
          },
        }
      : {}),
  });
}

/** Whether the brand has something to do on the post: an ask waiting, the window open, or objected (RW-FR-25). */
const brandHasWork = (d: Deliverable) =>
  d.state === "fully_passing" || d.state === "objected" || (d.state === "results" && d.items.some((i) => i.status === "waiting_for_brand"));

// Mock only: a readable token per post. The real link is unguessable, scoped and expiring (RW-BR-08).
const REVIEW_TOKEN = "review_";

/**
 * The creator's deliverable with its review link while the brand has
 * something to do on it (DC-FR-52), as every creator response carries it.
 */
export function creatorView(d: Deliverable): Deliverable {
  const out = structuredClone(d);
  const dealId = dealOfDeliverable(d.id);
  if (dealId && brandHasWork(d)) {
    const emailedTo = brandEmailFor(dealId);
    out.reviewLink = { url: `https://cleared.example/b/${REVIEW_TOKEN}${d.id}`, ...(emailedTo ? { emailedTo } : {}) };
  }
  return out;
}

/**
 * Where a post's review stands, for its line on the brand's deal page; asks
 * count the items still waiting for the brand.
 *
 * @see docs/specs/brand-review-frd.md RW-FR-01
 */
export function postReview(deliverableId: string) {
  const d = findDeliverable(deliverableId);
  if (!d) return undefined;
  const review = reviewOf(d);
  switch (review.state) {
    case "asked":
      return { state: "asked" as const, count: d.items.filter((i) => i.status === "waiting_for_brand").length };
    case "objected":
      return { state: "objected" as const, count: d.items.filter((i) => i.status === "objected_by_brand").length };
    case "window":
      return { state: "window" as const, endsAt: review.endsAt };
    default:
      return { state: review.state };
  }
}

/** Every draft-check item passed or was accepted: the window opens (DC-BR-03). */
function openWindowIfPassing(d: Deliverable) {
  const open = d.items.every((i) => ["passed", "accepted_by_brand", "at_live_check"].includes(i.status));
  if (d.state === "results" && open) {
    d.state = "fully_passing";
    d.reviewWindowEndsAt = new Date(Date.now() + WINDOW_MS).toISOString();
  }
}

const noteText = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
const base = `${apiBaseUrl}/brand/deals/:dealId/deliverables/:deliverableId`;

export const brandReviewHandlers: RequestHandler[] = [
  // RW-FR-03: a review link opens the deal's session and lands on its post, while the brand has something to do there.
  // Other tokens fall through to the invite link's swap (CH-FR-01).
  http.post(`${apiBaseUrl}/b/:token/session`, ({ params }) => {
    const token = String(params.token);
    if (!token.startsWith(REVIEW_TOKEN)) return undefined;
    const deliverableId = token.slice(REVIEW_TOKEN.length);
    const dealId = dealOfDeliverable(deliverableId);
    const d = findDeliverable(deliverableId);
    if (!dealId || !d || !brandHasWork(d)) return notFound();
    startBrandSession(dealId);
    return HttpResponse.json({ dealId, deliverableId });
  }),

  // RW-FR-05 to RW-FR-10
  http.get(base, ({ params }) => {
    const dealId = String(params.dealId);
    const d = sessionPost(dealId, String(params.deliverableId));
    const view = d && brandDeliverableFor(dealId, d);
    return view ? HttpResponse.json(view) : notFound();
  }),

  // RW-FR-13: only an item the creator asked about; the window opens if nothing else is open.
  http.post(`${base}/items/:itemId/accept`, ({ params }) => {
    const dealId = String(params.dealId);
    const d = sessionPost(dealId, String(params.deliverableId));
    const item = d?.items.find((i) => i.id === params.itemId);
    if (!d || !item) return notFound();
    if (item.status !== "waiting_for_brand") return refused();
    Object.assign(item, { status: "accepted_by_brand", askable: false });
    openWindowIfPassing(d);
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // RW-FR-16, RW-FR-21: in the window, or after objecting ("approve anyway"); objections are withdrawn.
  http.post(`${base}/approve`, ({ params }) => {
    const dealId = String(params.dealId);
    const d = sessionPost(dealId, String(params.deliverableId));
    if (!d) return notFound();
    if (d.state !== "fully_passing" && d.state !== "objected") return refused();
    for (const i of d.items) if (i.status === "objected_by_brand") Object.assign(i, { status: "passed", brandNote: undefined });
    Object.assign(d, { state: "approved", approvedAt: new Date().toISOString(), approvedBy: "brand", reviewWindowEndsAt: undefined, objectedAt: undefined });
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // RW-FR-17, RW-FR-18, RW-BR-02 to RW-BR-04: once per draft, in the window, each on a passed item with a note. Stops the clock.
  http.post(`${base}/objections`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const d = sessionPost(dealId, String(params.deliverableId));
    if (!d) return notFound();
    const { objections } = (await request.json()) as { objections?: { itemId?: unknown; note?: unknown }[] };
    if (d.state !== "fully_passing" || !Array.isArray(objections) || objections.length === 0) return refused();
    const ids = new Set<string>();
    const ok = objections.every((o) => {
      const item = d.items.find((i) => i.id === o.itemId);
      const note = noteText(o.note);
      if (!item || item.status !== "passed" || ids.has(item.id) || !note || note.length > NOTE_MAX) return false;
      ids.add(item.id);
      return true;
    });
    if (!ok) return refused();
    for (const o of objections) Object.assign(d.items.find((i) => i.id === o.itemId)!, { status: "objected_by_brand", brandNote: noteText(o.note) });
    Object.assign(d, { state: "objected", objectedAt: new Date().toISOString(), reviewWindowEndsAt: undefined });
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // Mock only: end a window now (RW-FR-20). Never part of the real API.
  http.post(`${apiBaseUrl}/__demo/review/:deliverableId/end-window`, ({ params }) => {
    const d = findDeliverable(String(params.deliverableId));
    if (!d) return notFound();
    if (d.state !== "fully_passing") return refused();
    d.reviewWindowEndsAt = new Date(Date.now() - 1000).toISOString();
    findDeliverable(d.id);
    return HttpResponse.json({ ended: true });
  }),

  // RW-FR-14: the creator sees it declined with the note (DC-FR-17); the note is optional, plain text.
  http.post(`${base}/items/:itemId/fix`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const d = sessionPost(dealId, String(params.deliverableId));
    const item = d?.items.find((i) => i.id === params.itemId);
    if (!d || !item) return notFound();
    const note = noteText(((await request.json()) as { note?: unknown }).note);
    if (item.status !== "waiting_for_brand" || (note && note.length > NOTE_MAX)) return refused();
    Object.assign(item, { status: "unsure", declined: true, askable: false, askedAt: undefined, ...(note ? { brandNote: note } : {}) });
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),
];
