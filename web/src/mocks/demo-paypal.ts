import { apiBaseUrl } from "@/lib/api";
import type { HoldOutcome } from "./brand-deals";

/** Mock only: tells the mock API what the demo PayPal answers to the next approval. Never part of the real API. */
export async function setDemoOutcome(outcome: HoldOutcome): Promise<void> {
  await fetch(`${apiBaseUrl}/__demo/paypal/next`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
}
