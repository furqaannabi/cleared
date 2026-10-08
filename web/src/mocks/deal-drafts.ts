import { http, HttpResponse, type RequestHandler } from "msw";
import { currentAccount, type Account } from "./session";
import type { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import type { dealDraftSchema } from "@/lib/api/schemas";
import { allHeld, brandNotes, heldCount, isRevising } from "./brand-deals";
import { checkedByFor, nextId, readBrief } from "./brief-reader";
import { juniperDraft } from "./fixtures/juniper";
import { findDeliverable } from "./store";

type Draft = z.infer<typeof dealDraftSchema>;
// `owner` is mock-only (SI-BR-03): the API's deal never carries it.
type Stored = Draft & { owner?: Account; readStartedAt?: number; pending?: Pick<Draft, "items" | "questions"> };

const STATUS: Record<Draft["step"], string> = {
  checklist: "Checklist",
  invite: "Invite",
  waiting_for_brand: "Waiting for brand",
  changes_requested: "Changes asked",
  agreed: "Agreed",
};

/*
 * Mock deal drafts for the brief → checklist step (BC FRD). In memory, reset
 * between tests. Reading is simulated: lines are read one by one over time,
 * and items and questions land as their lines are reached.
 */
let drafts = new Map<string, Stored>();
let msPerLine = 450;

const MAPLE_BRIEF = [
  "Thanks for partnering with Maple & Moss on the Ember candle launch!",
  "In the YouTube video, say “Maple & Moss” in the first 60 seconds.",
  "Mention us early in the Reel.",
  "Say and show the code MOSS10.",
  "Keep it fun and cosy!",
  "Mark the post as a paid promotion.",
];

const PINE_BRIEF = [
  "Thanks for working with Pine & Co on the Trail Flask launch.",
  "In the YouTube video, say “Pine & Co” in the first 60 seconds.",
  "Show the Trail Flask being filled and carried outdoors.",
  "Say and show the code PINE15.",
  "Put pineandco.com/ada in the YouTube description, and #PineTrail in the Reel caption.",
  "Mark the post as a paid promotion.",
];

/**
 * IN 1.1: a demo deal already at the invite step (checklist ready, amounts
 * and deadlines blank), so the invite page is one click from the rail after
 * any reload. Synthetic, like every fixture.
 */
function seedDemoDrafts() {
  const deliverables: Draft["deliverables"] = [
    { id: "del_pine_video", platform: "youtube_video" },
    { id: "del_pine_reel", platform: "instagram_reel" },
  ];
  const lines = PINE_BRIEF.map((text, i) => ({ number: i + 1, text }));
  const read = readBrief(lines, deliverables, "Pine & Co");
  drafts.set("deal_pine", {
    id: "deal_pine",
    brandName: "Pine & Co",
    step: "invite",
    deliverables,
    brief: { lines },
    reading: "done",
    readUpTo: lines.length,
    items: read.items,
    questions: read.questions,
    ready: true,
  });

  // CH 1.0: a demo deal already sent to the brand, its link seeded in the invite mocks.
  const maple: Draft["deliverables"] = [
    { id: "del_maple_video", platform: "youtube_video" },
    { id: "del_maple_reel", platform: "instagram_reel" },
    { id: "del_maple_short", platform: "youtube_short" },
  ];
  const mapleLines = MAPLE_BRIEF.map((text, i) => ({ number: i + 1, text }));
  const mapleRead = readBrief(mapleLines, maple, "Maple & Moss");
  const d: Stored = {
    id: "deal_maple",
    brandName: "Maple & Moss",
    step: "waiting_for_brand",
    deliverables: maple,
    brief: { lines: mapleLines },
    reading: "done",
    readUpTo: mapleLines.length,
    items: mapleRead.items,
    questions: mapleRead.questions,
    ready: true,
  };
  for (const q of d.questions) applyAnswer(d, q, q.suggestions.length ? { kind: "suggestion", text: q.suggestions[0] } : { kind: "left_out" });
  d.items.push({ id: "it_maple_link", deliverableId: "del_maple_video", name: "maplemoss.com/ada in the description", kind: "written", addedByCreator: true, checkedBy: "at_live_check" });
  drafts.set(d.id, d);

  // RW 1.0: a demo deal with every post held, in the brand's review states.
  const juniper = juniperDraft();
  drafts.set(juniper.id, juniper);
}
seedDemoDrafts();

/** Records an answer; a suggestion or the creator's own words becomes an item on the posts the line is about (BC-FR-13). */
function applyAnswer(d: Draft, q: Draft["questions"][number], answer: NonNullable<Draft["questions"][number]["answer"]>) {
  q.answer = answer.kind === "left_out" ? { kind: "left_out" } : { kind: answer.kind, text: answer.text!.trim().slice(0, 200) };
  if (answer.kind === "left_out") return;
  const line = d.brief!.lines.find((l) => l.number === q.briefLine)!;
  const name = answer.kind === "own_words" ? answer.text!.trim() : `Mentions ${d.brandName} ${answer.text!.trim().replace(/^In/, "in")}`;
  for (const deliverableId of readBrief([line], d.deliverables, d.brandName).targetsFor(line.number)) {
    d.items.push({ id: nextId("it"), deliverableId, name, kind: "timing", briefLine: q.briefLine, addedByCreator: false, checkedBy: "ai_timestamp" });
  }
  d.items.sort((a, b) => (a.briefLine ?? 1e9) - (b.briefLine ?? 1e9));
}

/** The mock deal drafts, for keeping the mock data in the browser. */
export const draftsData = { get: () => [...drafts.entries()], set: (entries: [string, Stored][]) => void (drafts = new Map(entries)) };

/** How long the mock takes per brief line (0 in tests that want it instant). */
export function setReadingSpeed(ms: number) {
  msPerLine = ms;
}

/** Clears every mock deal draft, leaving only the seeded demo deal. */
export function resetDealDrafts() {
  drafts = new Map();
  msPerLine = 450;
  seedDemoDrafts();
}

/** The mock deal drafts, as deal summaries for GET /deals. */
export function draftSummaries(owner: Account = "demo") {
  return [...drafts.values()].filter((d) => (d.owner ?? "demo") === owner).map((d) => {
    // CH-FR-21: once every post is held the deal leaves set-up, for its first post's draft check.
    if (allHeld(d.id)) return heldSummary(d);
    const { held, posts } = heldCount(d.id);
    const status = isRevising(d.id) ? STATUS.changes_requested : d.step === "agreed" ? `Agreed · ${held} of ${posts} held` : STATUS[d.step];
    return { id: d.id, brandName: d.brandName, status, step: d.step, deliverables: [] };
  });
}

/** The deal a post belongs to, if any. */
export function dealOfDeliverable(deliverableId: string): string | undefined {
  for (const d of drafts.values()) if (d.deliverables.some((x) => x.id === deliverableId)) return d.id;
  return undefined;
}

/**
 * A deal past set-up: each post's own state, and the post whose next step is
 * the creator's (DC-FR-37), else the first. RW: a brand objection leads.
 */
function heldSummary(d: Draft) {
  const posts = d.deliverables.map((x) => ({ id: x.id, platform: x.platform, state: findDeliverable(x.id)?.state ?? ("no_draft" as const) }));
  const needsCreator = (id: string) => {
    const x = findDeliverable(id);
    if (!x) return true;
    if (["no_draft", "objected", "check_failed", "approved", "posting"].includes(x.state)) return true;
    // PP-FR-24: a live post to fix, or a payout that needs the creator.
    if (x.state === "published" && x.liveCheck?.state === "fixable") return true;
    if (x.state === "captured" && (x.payout?.state === "unclaimed" || x.payout?.state === "failed")) return true;
    return x.state === "results" && x.items.some((i) => i.status === "fix_needed" || i.status === "unsure");
  };
  const states = posts.map((p) => p.state);
  const payoutProblem = posts.some((p) => ["unclaimed", "failed"].includes(findDeliverable(p.id)?.payout?.state ?? ""));
  const status = payoutProblem
    ? "Payout needs you"
    : states.includes("objected")
    ? `${d.brandName} objected`
    : states.some((s) => s === "approved" || s === "posting")
      ? "Ready to post"
      : states.includes("published")
        ? "Live check"
        : states.every((s) => s === "paid")
          ? "Paid"
    : states.every((s) => s === "no_draft")
      ? "Waiting for your draft"
      : posts.some((p) => needsCreator(p.id))
        ? "Draft check"
        : states.every((s) => s === "approved")
          ? "Approved"
          : "Brand review";
  return { id: d.id, brandName: d.brandName, status, openDeliverableId: (posts.find((p) => needsCreator(p.id)) ?? posts[0]).id, deliverables: posts };
}

/** One stored deal draft, for the invite mocks (IN FRD); undefined if there is none. */
export function findDraft(id: string): Draft | undefined {
  return drafts.get(id);
}

/** The draft as the API returns it: reading progress applied, internals removed. */
function view(d: Stored): Draft {
  if (d.reading === "reading" && d.brief && d.pending) {
    const total = d.brief.lines.length;
    const upTo = msPerLine === 0 ? total : Math.min(total, Math.floor((Date.now() - (d.readStartedAt ?? 0)) / msPerLine));
    d.readUpTo = upTo;
    d.items = d.pending.items.filter((i) => i.briefLine! <= upTo);
    d.questions = d.pending.questions.filter((q) => q.briefLine <= upTo);
    if (upTo >= total) {
      d.reading = "done";
      d.pending = undefined;
    }
  }
  const { readStartedAt, pending, ...out } = d;
  void readStartedAt;
  void pending;
  const notes = brandNotes(d.id);
  return structuredClone(notes ? { ...out, notes } : out);
}

const json = (d: Stored) => HttpResponse.json(view(d));
const notFound = () => HttpResponse.json({ message: "Not found" }, { status: 404 });
const refused = () => HttpResponse.json({ message: "Refused" }, { status: 409 });
const editable = (d: Stored | undefined): d is Stored => !!d && d.reading === "done" && !d.ready;

export const dealDraftHandlers: RequestHandler[] = [
  // BC-FR-03
  http.post(`${apiBaseUrl}/deals`, async ({ request }) => {
    const body = (await request.json()) as { brandName?: string; deliverables?: { platform: Draft["deliverables"][number]["platform"] }[] };
    const brandName = body.brandName?.trim();
    if (!brandName || !body.deliverables?.length || body.deliverables.length > 10) return refused();
    const d: Stored = {
      id: nextId("deal"),
      // SI-BR-03: the deal belongs to whoever made it.
      owner: currentAccount() ?? "demo",
      brandName,
      step: "checklist",
      deliverables: body.deliverables.map((x) => ({ id: nextId("del"), platform: x.platform })),
      reading: "idle",
      items: [],
      questions: [],
      ready: false,
    };
    drafts.set(d.id, d);
    return json(d);
  }),

  http.get(`${apiBaseUrl}/deals/:dealId`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    return d ? json(d) : notFound();
  }),

  // BC-FR-23: only before the brief is sent, or after it couldn't be read.
  http.patch(`${apiBaseUrl}/deals/:dealId`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    if (!d) return notFound();
    const body = (await request.json()) as { brandName?: string; deliverables?: { id?: string; platform: Draft["deliverables"][number]["platform"] }[] };
    const brandName = body.brandName?.trim();
    const known = new Set(d.deliverables.map((x) => x.id));
    const bad = !brandName || !body.deliverables?.length || body.deliverables.length > 10 || body.deliverables.some((x) => x.id && !known.has(x.id));
    if ((d.reading !== "idle" && d.reading !== "failed") || bad) return refused();
    d.brandName = brandName!;
    d.deliverables = body.deliverables!.map((x) => ({ id: x.id ?? nextId("del"), platform: x.platform }));
    return json(d);
  }),

  // BC-FR-04, BC-FR-05, BC-FR-07
  http.post(`${apiBaseUrl}/deals/:dealId/brief`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    if (!d) return notFound();
    const { text } = (await request.json()) as { text?: string };
    if (!text || text.trim().length < 40 || text.length > 20_000 || d.reading !== "idle") return refused();
    const lines = text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((t, i) => ({ number: i + 1, text: t }));
    d.brief = { lines };
    const read = readBrief(lines, d.deliverables, d.brandName);
    d.pending = { items: read.items, questions: read.questions };
    d.reading = "reading";
    d.readUpTo = 0;
    d.readStartedAt = Date.now();
    return json(d);
  }),

  // BC-FR-13
  http.put(`${apiBaseUrl}/deals/:dealId/questions/:qid`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    const q = d?.questions.find((x) => x.id === params.qid);
    if (!editable(d) || !q || q.answer) return d ? refused() : notFound();
    const answer = (await request.json()) as NonNullable<Draft["questions"][number]["answer"]>;
    if (answer.kind !== "left_out" && !answer.text?.trim()) return refused();
    applyAnswer(d, q, answer);
    return json(d);
  }),
  http.delete(`${apiBaseUrl}/deals/:dealId/questions/:qid`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    const q = d?.questions.find((x) => x.id === params.qid);
    if (!editable(d) || !q) return d ? refused() : notFound();
    q.answer = undefined;
    d.items = d.items.filter((i) => i.briefLine !== q.briefLine || i.addedByCreator);
    return json(d);
  }),

  // BC-FR-14
  http.patch(`${apiBaseUrl}/deals/:dealId/items/:itemId`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    const item = d?.items.find((i) => i.id === params.itemId);
    const { name } = (await request.json()) as { name?: string };
    if (!editable(d) || !item || !name?.trim() || name.length > 200) return d ? refused() : notFound();
    item.name = name.trim();
    return json(d);
  }),
  http.delete(`${apiBaseUrl}/deals/:dealId/items/:itemId`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    if (!editable(d) || !d.items.some((i) => i.id === params.itemId)) return d ? refused() : notFound();
    d.items = d.items.filter((i) => i.id !== params.itemId);
    return json(d);
  }),
  http.post(`${apiBaseUrl}/deals/:dealId/items/:itemId/:how`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    const item = d?.items.find((i) => i.id === params.itemId);
    const { deliverableId } = (await request.json()) as { deliverableId?: string };
    if (!editable(d) || !item || !d.deliverables.some((x) => x.id === deliverableId) || deliverableId === item.deliverableId) return d ? refused() : notFound();
    if (params.how === "move") item.deliverableId = deliverableId!;
    else if (params.how === "copy") d.items.splice(d.items.indexOf(item) + 1, 0, { ...item, id: nextId("it"), deliverableId: deliverableId! });
    else return notFound();
    return json(d);
  }),

  // BC-FR-15
  http.post(`${apiBaseUrl}/deals/:dealId/items`, async ({ params, request }) => {
    const d = drafts.get(String(params.dealId));
    const body = (await request.json()) as { deliverableId?: string; name?: string; kind?: Draft["items"][number]["kind"] };
    if (!editable(d) || !body.kind || !body.name?.trim() || !d.deliverables.some((x) => x.id === body.deliverableId)) return d ? refused() : notFound();
    d.items.push({ id: nextId("it"), deliverableId: body.deliverableId!, name: body.name.trim().slice(0, 200), kind: body.kind, addedByCreator: true, checkedBy: checkedByFor(body.kind) });
    return json(d);
  }),

  // BC-FR-16, BC-BR-02
  http.post(`${apiBaseUrl}/deals/:dealId/checklist/ready`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    if (!d) return notFound();
    const open = d.questions.some((q) => !q.answer);
    const empty = d.deliverables.some((x) => !d.items.some((i) => i.deliverableId === x.id));
    if (!editable(d) || open || empty) return refused();
    d.ready = true;
    // CH-FR-22: while answering the brand's notes, ready goes back to "changes asked", not a fresh invite.
    d.step = isRevising(d.id) ? "changes_requested" : "invite";
    return json(d);
  }),

  // IN-FR-03: back to the checklist before the link exists, or while answering the brand's notes (CH-FR-22).
  http.post(`${apiBaseUrl}/deals/:dealId/checklist/reopen`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    if (!d) return notFound();
    if (d.step !== "invite" && d.step !== "changes_requested") return refused();
    d.ready = false;
    d.step = "checklist";
    return json(d);
  }),
];
