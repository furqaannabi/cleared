import type { components } from "contract";
import { http, HttpResponse } from "msw";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";

/** The creator's profile as the contract's `GET /me` answers it. */
export type Profile = components["schemas"]["Profile"];

/** A deal at the brief → checklist step, as the contract's `GET /deals/{id}` answers it. */
export type DealDraft = components["schemas"]["DealDraft"];

/** A new deal with Glow Theory, before its brief is sent; override any field. */
export const aDealDraft = (d: Partial<DealDraft> = {}): DealDraft => ({
  id: "deal_new",
  brandName: "Glow Theory",
  step: "checklist",
  deliverables: [{ id: "del_new_video", platform: "youtube_video" }],
  reading: "idle",
  items: [],
  questions: [],
  ready: false,
  ...d,
});

/** A deal's invite terms, as the contract's `GET /deals/{id}/invite` answers it. */
export type Invite = components["schemas"]["Invite"];

/** Pine & Co at the invite step: a YouTube video with nothing set yet; override any field. */
export const anInvite = (i: Partial<Invite> = {}): Invite => ({
  dealId: "deal_pine",
  brandName: "Pine & Co",
  step: "invite",
  posts: [{ deliverableId: "del_pine_video", platform: "youtube_video", itemCount: 3 }],
  ...i,
});

/** This test's answer to `GET /deals/{id}/invite`. */
export const stubInvite = (invite: Invite) => server.use(http.get(`${apiBaseUrl}/deals/${invite.dealId}/invite`, () => HttpResponse.json(invite)));

/** The deal as the brand sees it, as the contract's `GET /brand/deals/{id}` answers it. */
export type BrandDeal = components["schemas"]["BrandDeal"];

/** Maple & Moss waiting to agree to one YouTube video; override any field. */
export const aBrandDeal = (d: Partial<BrandDeal> = {}): BrandDeal => ({
  dealId: "deal_maple",
  creatorName: "Ada Okafor",
  brandName: "Maple & Moss",
  step: "waiting_for_brand",
  version: 1,
  posts: [{ deliverableId: "del_maple_video", platform: "youtube_video", amount: "800.00", deadlineDays: 14, hold: { state: "not_started" } }],
  items: [{ id: "it_maple_say", deliverableId: "del_maple_video", name: "Say “Maple & Moss” in the first minute", briefLine: 1, addedByCreator: false }],
  brief: [{ number: 1, text: "Say “Maple & Moss” in the first minute." }],
  answers: [],
  notes: [],
  ...d,
});

/** This test's answer to `GET /brand/deals/{id}`. */
export const stubBrandDeal = (deal: BrandDeal) => server.use(http.get(`${apiBaseUrl}/brand/deals/${deal.dealId}`, () => HttpResponse.json(deal)));

/** The contract's error body: `{ error: { code, … } }`. */
export const apiError = (error: components["schemas"]["Error"]["error"], status: number) => HttpResponse.json({ error }, { status });

/** A signed-in creator who has seen the welcome; override any field. */
export const aProfile = (p: Partial<Profile> = {}): Profile => ({
  name: "Ada Okafor",
  email: "ada.okafor@example.com",
  welcomed: true,
  accounts: [{ platform: "youtube", name: "Ada Okafor" }],
  ...p,
});

const signedOut = () => HttpResponse.json({ error: { code: "signed_out" } } satisfies components["schemas"]["Error"], { status: 401 });

/**
 * Per-test stubs (docs/decisions/2026-10-11-frontend-on-the-live-api.md):
 * this test's answer to `GET /me`, `POST /me/welcomed`, `PUT
 * /me/paypal-email` and `POST /auth/sign-out`. A profile signs the creator
 * in; null answers 401. Each change is what `GET /me` answers next.
 */
export function stubSession(profile: Profile | null) {
  let me = profile;
  server.use(
    http.get(`${apiBaseUrl}/me`, () => (me ? HttpResponse.json(me) : signedOut())),
    http.post(`${apiBaseUrl}/me/welcomed`, () => (me ? HttpResponse.json((me = { ...me, welcomed: true })) : signedOut())),
    http.put(`${apiBaseUrl}/me/paypal-email`, async ({ request }) => {
      const { email } = (await request.json()) as { email: string };
      return me ? HttpResponse.json({ ...(me = { ...me, paypalEmail: email }), postsKeepingEmail: [] }) : signedOut();
    }),
    http.post(`${apiBaseUrl}/auth/sign-out`, () => {
      me = null;
      return HttpResponse.json({});
    }),
  );
}
