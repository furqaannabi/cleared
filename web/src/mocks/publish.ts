import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { hasBrandSession } from "./brand-deals";
import { brandDeliverableFor, creatorView } from "./brand-review";
import { dealOfDeliverable } from "./deal-drafts";
import { payoutEmail } from "./invites";
import { capture, choosePayout, takePayoutOutcome, type LiveOutcome, type Mocked, type PayoutOutcome } from "./publish-settle";
import { findDeliverable } from "./store";

/*
 * Mock publish and pay (PP FRD): the go-ahead, "I've posted it", the live
 * check, the brand's decisions after posting and the payout. The rules are
 * the money path FRD's; the outcomes are the demo's (PP-FR-32). Nothing
 * reaches PayPal or a platform.
 */

type GoAheadOutcome = "go" | "wait" | "not_confirmed";
let next: { goAhead: GoAheadOutcome; live: LiveOutcome } = { goAhead: "go", live: "passed" };

/** Back to the demo's usual outcomes. */
export function resetPublish() {
  next = { goAhead: "go", live: "passed" };
  choosePayout("paid");
}

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const notFound = () => HttpResponse.json({ message: "Not found" }, { status: 404 });
const refused = () => HttpResponse.json({ message: "Refused" }, { status: 409 });
const INSTAGRAM_POST = /^https:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+\/?$/;
const mocked = (id: string) => findDeliverable(id) as Mocked | undefined;

/** A brand's post: the session's deal, and published. */
function brandPost(dealId: string, deliverableId: string) {
  if (!hasBrandSession(dealId) || dealOfDeliverable(deliverableId) !== dealId) return undefined;
  return mocked(deliverableId);
}

export const publishHandlers: RequestHandler[] = [
  // PP-FR-01 to PP-FR-05, MP-FR-10, MP-FR-13: asked when the creator is ready; never past the deadline.
  http.post(`${apiBaseUrl}/deliverables/:id/go-ahead`, ({ params }) => {
    const d = mocked(String(params.id));
    if (!d) return notFound();
    const now = Date.now();
    const waiting = d.goAhead?.state === "wait" && Date.parse(d.goAhead.until) > now;
    if (d.state !== "approved" || waiting) return refused();
    const outcome = next.goAhead;
    next.goAhead = "go";
    if (outcome === "go") Object.assign(d, { state: "posting", goAhead: { state: "go", endsAt: iso(Math.min(now + 48 * HOUR, Date.parse(d.deadline))) } });
    else if (outcome === "wait") d.goAhead = { state: "wait", until: iso(now + 6 * HOUR) };
    else d.goAhead = { state: "not_confirmed" };
    return HttpResponse.json(creatorView(d));
  }),

  // PP-FR-06, PP-FR-07, MP-FR-16: only with a go-ahead running; a Reel gives its link.
  http.post(`${apiBaseUrl}/deliverables/:id/posted`, async ({ params, request }) => {
    const d = mocked(String(params.id));
    if (!d) return notFound();
    const { url } = (await request.json().catch(() => ({}))) as { url?: unknown };
    if (d.state !== "posting") return refused();
    const reel = d.platform === "instagram_reel";
    if (reel && (typeof url !== "string" || !INSTAGRAM_POST.test(url))) return refused();
    const now = Date.now();
    const link = reel ? (url as string) : `https://www.youtube.com/watch?v=${d.id.replace(/\W/g, "").slice(-11)}`;
    Object.assign(d, { state: "published", post: { url: link, publishedAt: iso(now) }, liveCheck: { state: "checking" }, _checkAt: now, _live: next.live, _payout: takePayoutOutcome() });
    next.live = "passed";
    for (const item of d.items) if (item.status === "at_live_check") item.status = "checking";
    return HttpResponse.json(creatorView(d));
  }),

  // PP-FR-12, MP-FR-20: within the fix window.
  http.post(`${apiBaseUrl}/deliverables/:id/live-check/again`, ({ params }) => {
    const d = mocked(String(params.id));
    if (!d) return notFound();
    if (d.state !== "published" || d.liveCheck?.state !== "fixable") return refused();
    Object.assign(d, { liveCheck: { state: "checking" }, _checkAt: Date.now(), _live: next.live });
    next.live = "passed";
    for (const item of d.items) if (item.evidence?.label === "On the live post") item.status = "checking";
    return HttpResponse.json(creatorView(d));
  }),

  // PP-FR-19, PP-FR-20, PP-FR-36, MP-FR-30: only once the last payout finished without paying.
  http.post(`${apiBaseUrl}/deliverables/:id/payout/again`, ({ params }) => {
    const d = mocked(String(params.id));
    if (!d) return notFound();
    if (d.state !== "captured" || !d.payout?.canSendAgain) return refused();
    // MP-FR-28: to the creator's PayPal email as it stands now.
    const email = payoutEmail() ?? d.payoutEmail;
    // PP-FR-36: an unclaimed payout is cancelled with PayPal first.
    const state = d.payout.state === "unclaimed" ? "cancelling" : "sending";
    Object.assign(d, { payoutEmail: email, payout: { state, email, at: iso(Date.now()), canSendAgain: false }, _payout: takePayoutOutcome() });
    return HttpResponse.json(creatorView(d));
  }),

  // PP-FR-27, MP-FR-18: the brand confirms a post the live check couldn't decide; that captures.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/deliverables/:id/post/confirm`, ({ params }) => {
    const dealId = String(params.dealId);
    const d = brandPost(dealId, String(params.id));
    if (!d) return notFound();
    if (d.state !== "published" || d.liveCheck?.state !== "undecided") return refused();
    capture(d, Date.now());
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // PP-FR-27, MP-FR-18, MP-BR-13: an objection with a reason (plain text, at most 500) goes to a person at Cleared.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/deliverables/:id/post/object`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const d = brandPost(dealId, String(params.id));
    if (!d) return notFound();
    const { reason } = (await request.json()) as { reason?: unknown };
    const text = typeof reason === "string" ? reason.trim() : "";
    if (d.state !== "published" || d.liveCheck?.state !== "undecided" || !text || text.length > 500) return refused();
    d.liveCheck = { state: "objected", reason: text, ruleBy: iso(Date.now() + 5 * 24 * HOUR) };
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // PP-FR-28, MP-FR-21: the brand accepts a post that failed; that captures.
  http.post(`${apiBaseUrl}/brand/deals/:dealId/deliverables/:id/post/accept`, ({ params }) => {
    const dealId = String(params.dealId);
    const d = brandPost(dealId, String(params.id));
    if (!d) return notFound();
    if (d.state !== "published" || d.liveCheck?.state !== "not_fixable") return refused();
    capture(d, Date.now());
    return HttpResponse.json(brandDeliverableFor(dealId, d));
  }),

  // Mock only (PP-FR-32): the demo's next outcomes, and the brand's 48 hours ending now. Never part of the real API.
  http.post(`${apiBaseUrl}/__demo/:what/next`, async ({ params, request }) => {
    const what = String(params.what);
    // Other demo controls (Demo PayPal) have their own route.
    if (!["go-ahead", "live-check", "payout"].includes(what)) return undefined;
    const { outcome } = (await request.json()) as { outcome?: string };
    const allowed: Record<string, string[]> = { "go-ahead": ["go", "wait", "not_confirmed"], "live-check": ["passed", "fixable", "not_fixable", "undecided"], payout: ["paid", "unclaimed", "failed", "wont_send"] };
    if (!allowed[what].includes(outcome ?? "")) return refused();
    if (what === "go-ahead") next.goAhead = outcome as GoAheadOutcome;
    if (what === "live-check") next.live = outcome as LiveOutcome;
    if (what === "payout") choosePayout(outcome as PayoutOutcome);
    return HttpResponse.json({ outcome });
  }),
  http.post(`${apiBaseUrl}/__demo/payout/:id/try-again`, ({ params }) => {
    const d = mocked(String(params.id));
    if (!d || d.state !== "captured" || d.payout?.state !== "delayed") return refused();
    d.payout = { ...d.payout, at: iso(Date.now() - 6 * HOUR) };
    findDeliverable(d.id);
    return HttpResponse.json({ tried: true });
  }),
  http.post(`${apiBaseUrl}/__demo/brand/:id/end-48h`, ({ params }) => {
    const d = mocked(String(params.id));
    const lc = d?.liveCheck;
    if (!d || d.state !== "published" || !lc || (lc.state !== "undecided" && lc.state !== "not_fixable")) return refused();
    d.liveCheck = { ...lc, brandBy: iso(Date.now() - 1000) };
    findDeliverable(d.id);
    return HttpResponse.json({ ended: true });
  }),
];

