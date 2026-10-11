import { http, HttpResponse, type RequestHandler } from "msw";
import { apiBaseUrl } from "@/lib/api";

/*
 * Mock only, for the surfaces not yet moved onto the live API
 * (docs/decisions/2026-10-11-frontend-on-the-live-api.md): one made-up
 * creator, Ada Okafor, who owns every seeded deal and starts signed in. The
 * real sign-in is the backend's, with an HttpOnly cookie the page never
 * reads; there is no mock sign-in and no demo account (SI 1.1). Tests of the
 * sign-in surface answer `/me` themselves (src/test/stub-api.ts).
 */

let signedIn = true;
let welcomed = true;

/** Who is signed in, for keeping the mock data in the browser. */
export const sessionData = {
  get: () => ({ signedIn, welcomed }),
  set: (s: { signedIn: boolean; welcomed: boolean }) => {
    signedIn = s.signedIn;
    welcomed = s.welcomed;
  },
};

/** Whether the mock creator is signed in. */
export const isSignedIn = () => signedIn;
/** Whether the mock creator has seen the welcome page (SI-FR-10). */
export const isWelcomed = () => welcomed;
/** Marks the welcome page seen. */
export const markWelcomed = () => void (welcomed = true);

/** Back to signed in, with the welcome seen. */
export function resetSession() {
  signedIn = true;
  welcomed = true;
}

export const sessionHandlers: RequestHandler[] = [
  // SI-FR-12
  http.post(`${apiBaseUrl}/auth/sign-out`, () => {
    signedIn = false;
    return HttpResponse.json({});
  }),
];
