import { http, HttpResponse, type RequestHandler } from "msw";
import { dealCancelled, postCancel } from "./cancel";
import type { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import type { creatorProfileSchema, dealInviteSchema } from "@/lib/api/schemas";
import { nextId } from "./brief-reader";
import { brandNotes, creatorExtras } from "./brand-deals";
import { findDraft } from "./deal-drafts";
import { JUNIPER, JUNIPER_TERMS, JUNIPER_TOKEN } from "./fixtures/juniper";

type Invite = z.infer<typeof dealInviteSchema>;
type Profile = z.infer<typeof creatorProfileSchema>;
type Terms = Pick<Invite["posts"][number], "amount" | "deadlineDays">;

/*
 * Mock invite step (IN FRD) and the creator's profile. In memory, reset
 * between tests. Terms are kept per deal even when the checklist is reopened
 * (IN-FR-03). Connecting an account succeeds at once with a synthetic one: no
 * real sign-in (IN-FR-11). Links are synthetic and open nothing yet.
 */
const DEMO_PROFILE: Profile = { name: "Ada Okafor", paypalEmail: "ada@example.com", accounts: [{ platform: "youtube", name: "Ada Okafor" }] };
const DEMO_ACCOUNT = { youtube: "Ada Okafor", instagram: "ada.makes" } as const;
const ORDER = ["youtube", "instagram"];
// The frontend's assumption until Furqaan sets the real length (IN-FR-17).
const LINK_DAYS = 7;

let profile: Profile = structuredClone(DEMO_PROFILE);
let terms = new Map<string, { posts: Record<string, Terms>; brandEmail?: string; link?: Invite["link"] }>();

/** The mock profile and invite terms, for keeping the mock data in the browser. */
export const invitesData = {
  get: () => ({ profile, terms: [...terms.entries()] }),
  set: (d: { profile: Profile; terms: [string, NonNullable<ReturnType<typeof terms.get>>][] }) => {
    profile = d.profile;
    terms = new Map(d.terms);
  },
};

/** Restores the demo profile and every deal's invite terms to the seed: only the demo deal already sent to its brand (CH 1.0). */
export function resetInvites() {
  profile = structuredClone(DEMO_PROFILE);
  terms = new Map();
  seedSentDeal();
}

function seedSentDeal() {
  terms.set("deal_maple", {
    posts: {
      del_maple_video: { amount: "1200.00", deadlineDays: 14 },
      del_maple_reel: { amount: "450.00", deadlineDays: 10 },
      del_maple_short: { amount: "300.00", deadlineDays: 7 },
    },
    link: { url: "https://cleared.example/b/demo_maple", expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString(), expired: false },
  });
  // RW 1.0: the held demo deal, its link still on so the brand can open it.
  terms.set(JUNIPER, {
    posts: structuredClone(JUNIPER_TERMS),
    link: { url: `https://cleared.example/b/${JUNIPER_TOKEN}`, expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString(), expired: false },
  });
}
seedSentDeal();

/** The deal a live link's token opens, or undefined for an unknown, turned-off or expired one (CH-FR-02). */
export function dealForToken(token: string): string | undefined {
  for (const [dealId, t] of terms) {
    // CN-FR-14: a cancelled deal's link answers as any link that doesn't work (CH-FR-02).
    if (dealCancelled(dealId)) continue;
    if (t.link && !t.link.expired && Date.parse(t.link.expiresAt) > Date.now() && t.link.url.endsWith(`/b/${token}`)) return dealId;
  }
  return undefined;
}

/** The brand's email, if the creator gave one (IN-FR-13). */
export const brandEmailFor = (dealId: string) => terms.get(dealId)?.brandEmail;

/** A deal's amount and deadline per post, for the brand's view. */
export function postTerms(dealId: string): Record<string, Terms> {
  return structuredClone(terms.get(dealId)?.posts ?? {});
}

function termsFor(dealId: string) {
  let t = terms.get(dealId);
  if (!t) terms.set(dealId, (t = { posts: {} }));
  return t;
}

/** The deal's invite as the API returns it, or undefined if the deal isn't at the invite step or after it. */
export function inviteFor(dealId: string): Invite | undefined {
  const d = findDraft(dealId);
  if (!d || d.step === "checklist") return undefined;
  const t = termsFor(dealId);
  const extras = creatorExtras(dealId);
  return structuredClone({
    dealId: d.id,
    brandName: d.brandName,
    step: d.step,
    posts: d.deliverables.map((x) => ({
      deliverableId: x.id,
      platform: x.platform,
      itemCount: d.items.filter((i) => i.deliverableId === x.id).length,
      ...t.posts[x.id],
      // CH-FR-25: each post's hold, once the brand has agreed.
      ...(d.step === "agreed" ? { hold: extras.holds[x.id] ?? { state: "not_started" as const } } : {}),
      // CN-FR-03, CN-FR-10, CN-FR-11
      ...postCancel(x.id),
    })),
    brandEmail: t.brandEmail,
    link: t.link,
    ...(t.link ? { version: extras.version } : {}),
    ...(brandNotes(dealId) ? { notes: brandNotes(dealId) } : {}),
  });
}

/** Where the creator is paid, for the draft checks the mock starts once every hold is in. */
export const payoutEmail = () => profile.paypalEmail ?? "ada@example.com";

/** Restarts the link's expiry when updated terms are sent (CH-FR-24). */
export function restartLink(dealId: string) {
  const link = terms.get(dealId)?.link;
  if (link) link.expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString();
}

/** Whether every term is in place for the link, or for sending updated terms (IN-FR-16, CH-FR-24). */
export function canCreate(invite: Invite): boolean {
  const needs = new Set(invite.posts.map((p) => (p.platform === "instagram_reel" ? "instagram" : "youtube")));
  return (
    invite.posts.every((p) => p.amount && p.deadlineDays) &&
    [...needs].every((n) => profile.accounts.some((a) => a.platform === n)) &&
    !!profile.paypalEmail
  );
}

function newLink(emailedTo: string | undefined): NonNullable<Invite["link"]> {
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString();
  return { url: `https://cleared.example/b/${nextId("demo")}`, expiresAt, emailedTo, expired: false };
}

const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const notFound = () => HttpResponse.json({ message: "Not found" }, { status: 404 });
const refused = () => HttpResponse.json({ message: "Refused" }, { status: 409 });
const invitePath = `${apiBaseUrl}/deals/:dealId/invite`;

export const inviteHandlers: RequestHandler[] = [
  // IN-FR-04
  http.get(invitePath, ({ params }) => {
    const invite = inviteFor(String(params.dealId));
    return invite ? HttpResponse.json(invite) : notFound();
  }),

  // IN-FR-05, IN-FR-07, IN-FR-15, IN-BR-03: editable only before the link exists.
  http.patch(`${invitePath}/posts/:deliverableId`, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const invite = inviteFor(dealId);
    if (!invite) return notFound();
    const id = String(params.deliverableId);
    const body = (await request.json()) as Terms;
    const badAmount = body.amount !== undefined && !/^\d{1,7}\.\d{2}$/.test(body.amount);
    const badDays = body.deadlineDays !== undefined && !(Number.isInteger(body.deadlineDays) && body.deadlineDays >= 1 && body.deadlineDays <= 21);
    const editableStep = invite.step === "invite" || invite.step === "changes_requested";
    if (!editableStep || !invite.posts.some((p) => p.deliverableId === id) || badAmount || badDays) return refused();
    const t = termsFor(dealId);
    t.posts[id] = { ...t.posts[id], ...body };
    return HttpResponse.json(inviteFor(dealId));
  }),

  // IN-FR-13
  http.patch(invitePath, async ({ params, request }) => {
    const dealId = String(params.dealId);
    const invite = inviteFor(dealId);
    if (!invite) return notFound();
    const { brandEmail } = (await request.json()) as { brandEmail?: string | null };
    const editableStep = invite.step === "invite" || invite.step === "changes_requested";
    if (!editableStep || (brandEmail !== null && !isEmail(brandEmail))) return refused();
    termsFor(dealId).brandEmail = brandEmail ?? undefined;
    return HttpResponse.json(inviteFor(dealId));
  }),

  // IN-FR-16, IN-FR-17, IN-BR-07
  http.post(`${invitePath}/link`, ({ params }) => {
    const dealId = String(params.dealId);
    const invite = inviteFor(dealId);
    if (!invite) return notFound();
    if (invite.step !== "invite" || !canCreate(invite)) return refused();
    const t = termsFor(dealId);
    t.link = newLink(t.brandEmail);
    findDraft(dealId)!.step = "waiting_for_brand";
    return HttpResponse.json(inviteFor(dealId));
  }),

  // IN-FR-18
  http.post(`${invitePath}/link/renew`, ({ params }) => {
    const dealId = String(params.dealId);
    const invite = inviteFor(dealId);
    if (!invite) return notFound();
    if (invite.step !== "waiting_for_brand") return refused();
    termsFor(dealId).link = newLink(undefined);
    return HttpResponse.json(inviteFor(dealId));
  }),

  // IN-FR-19
  http.delete(`${invitePath}/link`, ({ params }) => {
    const dealId = String(params.dealId);
    const invite = inviteFor(dealId);
    if (!invite) return notFound();
    if (invite.step !== "waiting_for_brand") return refused();
    termsFor(dealId).link = undefined;
    findDraft(dealId)!.step = "invite";
    return HttpResponse.json(inviteFor(dealId));
  }),

  // IN-FR-10, IN-FR-12
  http.get(`${apiBaseUrl}/me`, () => HttpResponse.json(profile)),
  http.put(`${apiBaseUrl}/me/paypal-email`, async ({ request }) => {
    const { email } = (await request.json()) as { email?: string };
    if (!isEmail(email)) return refused();
    profile.paypalEmail = email;
    return HttpResponse.json(profile);
  }),

  // IN-FR-11: provisional; the real flow is a sign-in redirect.
  http.post(`${apiBaseUrl}/me/accounts/:platform`, ({ params }) => {
    const platform = params.platform;
    if (platform !== "youtube" && platform !== "instagram") return notFound();
    if (!profile.accounts.some((a) => a.platform === platform)) profile.accounts.push({ platform, name: DEMO_ACCOUNT[platform] });
    profile.accounts.sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform));
    return HttpResponse.json(profile);
  }),
];
