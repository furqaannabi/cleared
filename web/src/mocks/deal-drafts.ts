import { http, HttpResponse, type RequestHandler } from "msw";
import type { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import type { dealDraftSchema } from "@/lib/api/schemas";
import { checkedByFor, nextId, readBrief } from "./brief-reader";

type Draft = z.infer<typeof dealDraftSchema>;
type Stored = Draft & { readStartedAt?: number; pending?: Pick<Draft, "items" | "questions"> };

const STATUS: Record<Draft["step"], string> = { checklist: "Checklist", invite: "Invite", waiting_for_brand: "Waiting for brand" };

/*
 * Mock deal drafts for the brief → checklist step (BC FRD). In memory, reset
 * between tests. Reading is simulated: lines are read one by one over time,
 * and items and questions land as their lines are reached.
 */
let drafts = new Map<string, Stored>();
let msPerLine = 450;

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
}
seedDemoDrafts();

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
export function draftSummaries() {
  return [...drafts.values()].map((d) => ({
    id: d.id,
    brandName: d.brandName,
    status: STATUS[d.step],
    step: d.step,
    deliverables: [],
  }));
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
  return structuredClone(out);
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
    q.answer = answer.kind === "left_out" ? { kind: "left_out" } : { kind: answer.kind, text: answer.text!.trim().slice(0, 200) };
    if (answer.kind !== "left_out") {
      const line = d.brief!.lines.find((l) => l.number === q.briefLine)!;
      const name = answer.kind === "own_words" ? answer.text!.trim() : `Mentions ${d.brandName} ${answer.text!.trim().replace(/^In/, "in")}`;
      for (const deliverableId of readBrief([line], d.deliverables, d.brandName).targetsFor(line.number)) {
        d.items.push({ id: nextId("it"), deliverableId, name, kind: "timing", briefLine: q.briefLine, addedByCreator: false, checkedBy: "ai_timestamp" });
      }
      d.items.sort((a, b) => (a.briefLine ?? 1e9) - (b.briefLine ?? 1e9));
    }
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
    d.step = "invite";
    return json(d);
  }),

  // IN-FR-03: back to the checklist, only before the link exists.
  http.post(`${apiBaseUrl}/deals/:dealId/checklist/reopen`, ({ params }) => {
    const d = drafts.get(String(params.dealId));
    if (!d) return notFound();
    if (d.step !== "invite") return refused();
    d.ready = false;
    d.step = "checklist";
    return json(d);
  }),
];
