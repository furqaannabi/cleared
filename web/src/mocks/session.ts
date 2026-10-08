import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";

/*
 * Mock only: who is signed in (SI FRD). The real sign-in is the backend's,
 * through Cognito, with an HttpOnly cookie the page never reads
 * (docs/decisions/2026-10-08-creator-sign-in-through-the-backend.md). Here
 * there are two made-up accounts: a new creator, Sam Rivera, with no deals,
 * and the demo creator, Ada Okafor, who owns every seeded deal.
 */

export type Account = "demo" | "new";

let account: Account | null = null;
let welcomed: Record<Account, boolean> = { demo: true, new: false };

/** Who is signed in, for keeping the mock data in the browser. */
export const sessionData = {
  get: () => ({ account, welcomed: { ...welcomed } }),
  set: (s: { account: Account | null; welcomed: Record<Account, boolean> }) => {
    account = s.account;
    welcomed = { ...s.welcomed };
  },
};

/** The signed-in account, or null. */
export const currentAccount = () => account;
/** Signs an account in (tests, and the mock sign-in route); null signs out. */
export const signInAs = (a: Account | null) => void (account = a);
/** Whether the account has seen the welcome page (SI-FR-10). */
export const isWelcomed = (a: Account) => welcomed[a];
/** Marks the welcome page seen for the signed-in account. */
export const markWelcomed = () => void (account && (welcomed[account] = true));

/** SI-FR-14: Reset demo data signs out and restores the seed. */
export function resetSession() {
  account = null;
  welcomed = { demo: true, new: false };
}

/** SI-BR-02: only a path on this site. */
const sitePath = (next: string | null) => (next && /^\/(?!\/)[^\s\\]*$/.test(next) ? next : null);

export const sessionHandlers: RequestHandler[] = [
  // Mock only (SI-FR-14): the two ways in, answering where to go next. The real build links to the backend instead.
  http.post(`${apiBaseUrl}/__demo/sign-in/:kind`, ({ params, request }) => {
    const next = sitePath(new URL(request.url).searchParams.get("next"));
    if (params.kind === "demo") {
      account = "demo";
      return HttpResponse.json({ location: next ?? "/deals" });
    }
    if (params.kind !== "google") return HttpResponse.json({ message: "Not found" }, { status: 404 });
    account = "new";
    return HttpResponse.json({ location: welcomed.new ? (next ?? "/deals") : "/welcome" });
  }),
  // SI-FR-12
  http.post(`${apiBaseUrl}/auth/sign-out`, () => {
    account = null;
    return HttpResponse.json({});
  }),
];
