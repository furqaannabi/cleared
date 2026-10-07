import type { Deliverable } from "@/lib/deliverable/types";
import { findDeliverable } from "./store";

/*
 * DC-FR-45: a mock-only stand-in for uploading a new draft, used while the
 * upload flow has no spec. Nothing is uploaded and the file is never read; the
 * in-memory mock store moves to Checking, then to a new run's results.
 * Loaded on demand by the page only when mocks are on, so it never ships.
 */

/** The synthetic outcome of a new run: the on-screen code is fixed, the serum is still unsure. */
const NEXT_RESULT: Record<string, Deliverable["items"][number]["status"]> = {
  it_5: "passed",
  it_6: "unsure",
};

/** DC-FR-45, DC-FR-48: this run's evidence for the items whose result changed. */
const NEXT_EVIDENCE: Record<string, Partial<NonNullable<Deliverable["items"][number]["evidence"]>>> = {
  it_5: { text: "Reads “GLOW20”, with a zero." },
};

/**
 * Simulates a new draft check for one mock deliverable.
 *
 * @param deliverableId - the mock deliverable
 * @param onChange - called with the deliverable at Checking, then with the results
 * @param delayMs - how long the simulated check takes
 */
export function simulateUpload(deliverableId: string, onChange: (d: Deliverable) => void, delayMs = 3000): void {
  const d = findDeliverable(deliverableId);
  if (!d) return;

  const before = new Map(d.items.map((i) => [i.id, i.status]));
  d.state = "checking";
  d.checkFailure = undefined;
  d.run = (d.run ?? 0) + 1;
  d.checkStartedAt = new Date().toISOString();
  d.stages = [
    { name: "Reading what’s said", status: "done" },
    { name: "Reading on-screen text", status: "done" },
    { name: "Watching the video", status: "current" },
    { name: "Checking each item", status: "waiting" },
  ];
  for (const item of d.items) {
    if (item.status === "at_live_check") continue;
    // DC-BR-04: a new draft cancels open asks and acceptances.
    Object.assign(item, { status: "checking", askedAt: undefined, declined: undefined, brandNote: undefined });
  }
  onChange(structuredClone(d));

  setTimeout(() => {
    d.state = "results";
    d.stages = undefined;
    d.checkStartedAt = undefined;
    for (const item of d.items) {
      if (item.status !== "checking") continue;
      const was = before.get(item.id)!;
      const now = NEXT_RESULT[item.id] ?? (was === "waiting_for_brand" || was === "accepted_by_brand" ? "unsure" : was);
      Object.assign(item, { previousStatus: was, status: now, askable: now === "unsure" });
      // Evidence always belongs to the latest run.
      if (NEXT_EVIDENCE[item.id] && item.evidence) item.evidence = { ...item.evidence, ...NEXT_EVIDENCE[item.id] };
    }
    onChange(structuredClone(d));
  }, delayMs);
}
