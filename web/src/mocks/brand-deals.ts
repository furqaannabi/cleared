import { http, HttpResponse, type RequestHandler } from "msw";
import type { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import type { brandDealSchema } from "@/lib/api/schemas";
import { nextId } from "./brief-reader";
import type { Deliverable } from "@/lib/deliverable/types";
import { findDraft } from "./deal-drafts";
import { canCreate, dealForToken, inviteFor, payoutEmail, postTerms, restartLink } from "./invites";
import { addDeliverable } from "./store";

type BrandDeal = z.infer<typeof brandDealSchema>;
type Note = BrandDeal["notes"][number];
type Hold = BrandDeal["posts"][number]["hold"];
/** What the demo PayPal answers when a hold is approved. */
export type HoldOutcome = "held" | "declined" | "pending" | "unknown";

/*
 * Mock confirm and hold (CH FRD), the brand's side. In memory, reset between
 * tests. The "session" is the set of deals whose link was opened since the
 * mock started: it stands in for the backend's HttpOnly cookie, so a reload
 * in the browser ends it (CH-FR-03). The deal's step lives on the creator's
 * draft; the version, notes and agreement live here. Nothing reaches PayPal.
 */
let sessions = new Set<string>();
interface BrandState {
  version: number;
  notes: Note[];
  agreedAt?: string;
  holds: Record<string, Hold>;
  /** From the brand sending notes until the creator sends updated terms (CH-FR-22, CH-FR-24). */
  revising: boolean;
  /** The terms the brand last saw, to mark what changed in the next version (CH-FR-13). */
  seen?: { items: Record<string, string>; terms: Record<string, { amount?: string; deadlineDays?: number }> };
  changed?: { items: string[]; posts: Record<string, ("amount" | "deadline")[]> };
}
let state = new Map<string, BrandState>();
// Open PayPal orders: order id → the post it's for.
let orders = new Map<string, string>();
let nextOutcome: HoldOutcome = "held";

/** Ends every brand session and forgets every note, agreement and hold. */
export function resetBrandDeals() {
  sessions = new Set();
  state = new Map();
  orders = new Map();
  nextOutcome = "held";
}

/** The brand's side, for keeping the mock data in the browser. The "sessions" are the mock's stand-in, never a real session. */
export const brandData = {
  get: () => ({ sessions: [...sessions], state: [...state.entries()], orders: [...orders.entries()], nextOutcome }),
  set: (d: { sessions: string[]; state: [string, BrandState][]; orders: [string, string][]; nextOutcome: HoldOutcome }) => {
    sessions = new Set(d.sessions);
    state = new Map(d.state);
    orders = new Map(d.orders);
    nextOutcome = d.nextOutcome;
  },
};

/** What the demo PayPal answers to the next approval (then back to "held"). Mock only. */
export function setNextHoldOutcome(outcome: HoldOutcome) {
  nextOutcome = outcome;
}

function stateFor(dealId: string) {
  let s = state.get(dealId);
  if (!s) state.set(dealId, (s = { version: 1, notes: [], holds: {}, revising: false }));
  return s;
}

const BRAND_STEPS = ["waiting_for_brand", "changes_requested", "agreed"] as const;
const isBrandStep = (step: string): step is BrandDeal["step"] => (BRAND_STEPS as readonly string[]).includes(step);

/** The deal as the brand sees it, built from the creator's draft and invite terms; never the PayPal email (CH-BR-08). */
function brandDealFor(dealId: string): BrandDeal | undefined {
  const d = findDraft(dealId);
  const s = state.get(dealId) ?? { version: 1, notes: [], holds: {}, revising: false };
  // While the creator revises, the brand sees changes requested, whichever page the creator is on.
  const step = s.revising ? "changes_requested" : d?.step;
  if (!d || !step || !isBrandStep(step) || !d.brief) return undefined;
  const terms = postTerms(dealId);
  const changedPosts = s.changed?.posts ?? {};
  return structuredClone({
    dealId: d.id,
    creatorName: "Ada Okafor",
    brandName: d.brandName,
    step,
    version: s.version,
    agreedAt: s.agreedAt,
    posts: d.deliverables.map((x) => ({
      deliverableId: x.id,
      platform: x.platform,
      amount: terms[x.id]?.amount ?? "0.00",
      deadlineDays: terms[x.id]?.deadlineDays ?? 1,
      hold: s.holds[x.id] ?? { state: "not_started" as const },
      ...(changedPosts[x.id]?.length ? { changed: changedPosts[x.id] } : {}),
    })),
    items: d.items.map(({ id, deliverableId, name, briefLine, addedByCreator }) => ({
      id,
      deliverableId,
      name,
      briefLine,
      addedByCreator,
      ...(s.changed?.items.includes(id) ? { changed: true } : {}),
    })),
    brief: d.brief.lines,
    answers: d.questions.flatMap((q) => (q.answer ? [{ briefLine: q.briefLine, ...q.answer }] : [])),
    notes: s.notes,
  });
}

/** Whether a note is about something on this deal (CH-FR-10). */
function onDeal(deal: BrandDeal, about: Note["about"]): boolean {
  switch (about.kind) {
    case "item":
      return deal.items.some((i) => i.id === about.itemId);
    case "line":
      return deal.brief.some((l) => l.number === about.briefLine);
    case "amount":
    case "deadline":
      return deal.posts.some((p) => p.deliverableId === about.deliverableId);
    default:
      return about.kind === "deal";
  }
}

// CH-FR-02, CH-FR-03: one answer for every link or deal the brand can't open.
const notFound = () => HttpResponse.json({ message: "Not found" }, { status: 404 });
const refused = () => HttpResponse.json({ message: "Refused" }, { status: 409 });
/** The deal, if this session opened its link. */
const sessionDeal = (dealId: string) => (sessions.has(dealId) ? brandDealFor(dealId) : undefined);

/** The post, if the deal is agreed and the post's hold can start: never twice, never while PayPal owes an answer (CH-BR-03, CH-BR-05). */
function holdable(deal: BrandDeal | undefined, deliverableId: string) {
  const post = deal?.step === "agreed" ? deal.posts.find((p) => p.deliverableId === deliverableId) : undefined;
  return post && ["not_started", "closed", "declined"].includes(post.hold.state) ? post : undefined;
}

/** A synthetic PayPal-like reference, clearly not a real one. */
const demoRef = () => `DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const holdPath = `${apiBaseUrl}/brand/deals/:dealId/posts/:deliverableId/hold`;

/** The brand's notes on a deal, for the creator's pages; undefined before any (CH-FR-22). */
export function brandNotes(dealId: string): Note[] | undefined {
  const notes = state.get(dealId)?.notes;
  return notes?.length ? structuredClone(notes) : undefined;
}

/** The terms version and each post's hold, for the creator's invite (CH-FR-24, CH-FR-25). */
export function creatorExtras(dealId: string) {
  const s = state.get(dealId);
  return { version: s?.version ?? 1, holds: structuredClone(s?.holds ?? {}) };
}

/** Whether the creator is answering the brand's notes (CH-FR-22). */
export const isRevising = (dealId: string) => !!state.get(dealId)?.revising;

/** How many of the deal's posts are held (CH-FR-21). */
export function heldCount(dealId: string): { held: number; posts: number } {
  const posts = findDraft(dealId)?.deliverables ?? [];
  const holds = state.get(dealId)?.holds ?? {};
  return { held: posts.filter((p) => holds[p.id]?.state === "held").length, posts: posts.length };
}

/** Every post held: the deal leaves set-up (CH-FR-21). */
export function allHeld(dealId: string): boolean {
  const { held, posts } = heldCount(dealId);
  return posts > 0 && held === posts;
}

const toMinor = (amount: string) => {
  const [whole, frac] = amount.split(".");
  return Number(whole) * 100 + Number(frac);
};
const CHECKED_BY = { exact_match: "exact_match", ai_timestamp: "ai_timestamp", at_live_check: "published_post" } as const;

/**
 * Every hold is in: each post gets its draft check, waiting for the first
 * draft, as the backend will create it (CH-FR-21, DC 1.13). Mock only.
 */
function startDraftChecks(dealId: string) {
  const d = findDraft(dealId)!;
  const deal = brandDealFor(dealId)!;
  const lines = new Map(d.brief!.lines.map((l) => [l.number, l.text]));
  for (const post of deal.posts) {
    if (post.hold.state !== "held") continue;
    const deliverable: Deliverable = {
      id: post.deliverableId,
      brandName: d.brandName,
      platform: post.platform,
      state: "no_draft",
      run: 0,
      // DC-FR-44: the end of the deadline's day for the creator (Lagos, UTC+1).
      deadline: `${post.hold.deadline}T22:59:00Z`,
      creatorTimeZone: "Africa/Lagos",
      brief: d.brief!.lines,
      hold: { amountMinor: toMinor(post.amount), currency: "USD", reference: post.hold.reference!, heldAt: new Date().toISOString(), stage: "held" },
      payoutEmail: payoutEmail(),
      items: d.items
        .filter((i) => i.deliverableId === post.deliverableId)
        .map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
          status: i.checkedBy === "at_live_check" ? "at_live_check" : "not_checked",
          checkedBy: CHECKED_BY[i.checkedBy],
          ...(i.briefLine ? { briefLine: { number: i.briefLine, text: lines.get(i.briefLine) ?? "" } } : {}),
        })),
    };
    addDeliverable(deliverable);
  }
}

export const brandDealHandlers: RequestHandler[] = [
  // CH-FR-01
  http.post(`${apiBaseUrl}/b/:token/session`, ({ params }) => {
    const dealId = dealForToken(String(params.token));
    if (!dealId || !brandDealFor(dealId)) return notFound();
    sessions.add(dealId);
    return HttpResponse.json({ dealId });
  }),

  // CH-FR-04 to CH-FR-09, CH-FR-20
  http.get(`${apiBaseUrl}/brand/deals/:dealId`, ({ params }) => {
    const deal = sessionDeal(String(params.dealId));
    return deal ? HttpResponse.json(deal) : notFound();
  }),

  // CH-FR-11, CH-FR-12: the notes, sent together; plain text, at most 500 characters each.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/notes`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const deal = sessionDeal(dealId);
    if (!deal) return notFound();
    const { notes } = (await request.json()) as { notes?: { about: Note["about"]; text: string }[] };
    const valid =
      Array.isArray(notes) &&
      notes.length > 0 &&
      notes.every((n) => typeof n.text === "string" && n.text.trim() && n.text.length <= 500 && n.about && onDeal(deal, n.about));
    if (deal.step !== "waiting_for_brand" || !valid) return refused();
    const s = stateFor(dealId);
    for (const n of notes) s.notes.push({ id: nextId("note"), about: n.about, text: n.text.trim(), version: s.version });
    s.revising = true;
    s.seen = { items: Object.fromEntries(deal.items.map((i) => [i.id, i.name])), terms: postTerms(dealId) };
    findDraft(dealId)!.step = "changes_requested";
    return HttpResponse.json(brandDealFor(dealId));
  }),

  // CH-FR-14 to CH-FR-16, CH-BR-02: only the version the brand was shown, and only once.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/agree`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const deal = sessionDeal(dealId);
    if (!deal) return notFound();
    const { version } = (await request.json()) as { version?: number };
    if (deal.step !== "waiting_for_brand" || version !== deal.version) return refused();
    stateFor(dealId).agreedAt = new Date().toISOString();
    findDraft(dealId)!.step = "agreed";
    return HttpResponse.json(brandDealFor(dealId));
  }),

  // CH-FR-17: start a hold. The real API creates the PayPal order; the mock hands back a synthetic id.
  http.post(holdPath, ({ params }) => {
    const dealId = String(params.dealId);
    const deliverableId = String(params.deliverableId);
    if (!sessions.has(dealId)) return notFound();
    if (!holdable(brandDealFor(dealId), deliverableId)) return refused();
    const orderId = nextId("DEMO-ORDER");
    orders.set(orderId, deliverableId);
    return HttpResponse.json({ orderId });
  }),

  // CH-FR-18: PayPal approved; the API authorizes and reports the hold. The demo's next answer decides it.
  http.post(`${holdPath}/approved`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const deliverableId = String(params.deliverableId);
    if (!sessions.has(dealId)) return notFound();
    const { orderId } = (await request.json()) as { orderId?: string };
    const post = holdable(brandDealFor(dealId), deliverableId);
    if (!post || !orderId || orders.get(orderId) !== deliverableId) return refused();
    orders.delete(orderId);
    const outcome = nextOutcome;
    nextOutcome = "held";
    // CH-BR-03: the post's deadline is fixed when its hold is approved.
    const deadline = new Date(Date.now() + post.deadlineDays * 86_400_000).toISOString().slice(0, 10);
    stateFor(dealId).holds[deliverableId] = outcome === "held" ? { state: "held", reference: demoRef(), deadline } : { state: outcome };
    if (allHeld(dealId)) startDraftChecks(dealId);
    return HttpResponse.json(brandDealFor(dealId));
  }),

  // CH-FR-18: the brand closed PayPal; nothing was held.
  http.post(`${holdPath}/closed`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const deliverableId = String(params.deliverableId);
    if (!sessions.has(dealId)) return notFound();
    const { orderId } = (await request.json()) as { orderId?: string };
    if (!holdable(brandDealFor(dealId), deliverableId) || !orderId || orders.get(orderId) !== deliverableId) return refused();
    orders.delete(orderId);
    stateFor(dealId).holds[deliverableId] = { state: "closed" };
    return HttpResponse.json(brandDealFor(dealId));
  }),

  // CH-FR-23: the creator's reply to a note; plain text, at most 500 characters.
  http.put(`${apiBaseUrl}/deals/:dealId/notes/:noteId/reply`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const note = state.get(dealId)?.notes.find((n) => n.id === params.noteId);
    if (!note) return notFound();
    const { reply } = (await request.json()) as { reply?: string };
    if (!isRevising(dealId) || typeof reply !== "string" || !reply.trim() || reply.length > 500) return refused();
    note.reply = reply.trim();
    return HttpResponse.json(inviteFor(dealId));
  }),

  // CH-FR-24: send updated terms to the same link: a new version, with what changed marked.
  http.post(`${apiBaseUrl}/deals/:dealId/invite/send`, ({ params }) => {
    const dealId = String(params.dealId);
    const d = findDraft(dealId);
    const invite = inviteFor(dealId);
    const s = state.get(dealId);
    if (!d || !invite) return notFound();
    if (!s?.revising || d.step !== "changes_requested" || !canCreate(invite)) return refused();
    const terms = postTerms(dealId);
    const posts: Record<string, ("amount" | "deadline")[]> = {};
    for (const x of d.deliverables) {
      const before = s.seen?.terms[x.id];
      const kinds = [
        ...(before?.amount !== terms[x.id]?.amount ? ["amount" as const] : []),
        ...(before?.deadlineDays !== terms[x.id]?.deadlineDays ? ["deadline" as const] : []),
      ];
      if (kinds.length) posts[x.id] = kinds;
    }
    s.changed = { items: d.items.filter((i) => s.seen?.items[i.id] !== i.name).map((i) => i.id), posts };
    s.version += 1;
    s.revising = false;
    d.step = "waiting_for_brand";
    restartLink(dealId);
    return HttpResponse.json(inviteFor(dealId));
  }),

  // Mock only: what the demo PayPal answers next. Never part of the real API.
  http.post(`${apiBaseUrl}/__demo/paypal/next`, async ({ request }) => {
    const { outcome } = (await request.json()) as { outcome?: HoldOutcome };
    if (!outcome || !["held", "declined", "pending", "unknown"].includes(outcome)) return refused();
    nextOutcome = outcome;
    return HttpResponse.json({ outcome });
  }),
];
