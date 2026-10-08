import { apiBaseUrl } from "@/lib/api";
import type { LiveOutcome, PayoutOutcome } from "./publish-settle";

/*
 * Mock only (PP-FR-32): tell the mock API the demo's next outcome, or end
 * the brand's 48 hours now. Never part of the real API.
 */
const post = (path: string, body?: unknown) =>
  fetch(`${apiBaseUrl}/__demo/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

/** What the next request for a go-ahead answers. */
export const setDemoGoAhead = async (outcome: "go" | "wait" | "not_confirmed") => void (await post("go-ahead/next", { outcome }));
/** What the next live check finds. */
export const setDemoLiveCheck = async (outcome: LiveOutcome) => void (await post("live-check/next", { outcome }));
/** What the next payout does. */
export const setDemoPayout = async (outcome: PayoutOutcome) => void (await post("payout/next", { outcome }));
/** Ends the brand's 48 hours on a post now; false when it isn't waiting on the brand. */
export const endBrandWait = async (deliverableId: string) => (await post(`brand/${encodeURIComponent(deliverableId)}/end-48h`)).ok;
