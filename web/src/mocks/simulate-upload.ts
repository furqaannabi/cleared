import type { Deliverable } from "@/lib/deliverable/types";
import { creatorView } from "./brand-review";
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

/** RW-FR-28: what the demo's next run finds. */
export type DemoOutcome = "passes" | "one_unsure";

const WINDOW_MS = 48 * 3_600_000;
const EVIDENCE: Record<Deliverable["items"][number]["kind"], { label: string; text: string }> = {
  said: { label: "Transcript", text: "Said clearly in the draft." },
  shown_as_text: { label: "On-screen text", text: "Readable on screen." },
  shown: { label: "In frame", text: "Shown in frame." },
  timing: { label: "Segment", text: "Within the time asked for." },
  written: { label: "When", text: "Checked once the post is public." },
  disclosure: { label: "When", text: "Checked once the post is public." },
  publication: { label: "When", text: "Checked once the post is public." },
};

/**
 * Simulates a new draft check for one mock deliverable.
 *
 * @param deliverableId - the mock deliverable
 * @param onChange - called with the deliverable at Checking, then with the results
 * @param delayMs - how long the simulated check takes
 * @param outcome - mocks only (RW-FR-28): every item passes, or one is unsure; omitted, the fixed DC-FR-45 run
 */
export function simulateUpload(deliverableId: string, onChange: (d: Deliverable) => void, delayMs = 3000, outcome?: DemoOutcome): void {
  const d = findDeliverable(deliverableId);
  if (!d) return;

  const before = new Map(d.items.map((i) => [i.id, i.status]));
  d.state = "checking";
  d.checkFailure = undefined;
  // RW-FR-23, DC-BR-04: a new draft gets a new review; the last one's objections and approval go.
  Object.assign(d, { reviewWindowEndsAt: undefined, objectedAt: undefined, approvedAt: undefined, approvedBy: undefined });
  d.draft ??= {
    fileName: "draft_v1.mp4",
    durationSec: d.platform === "youtube_video" ? 408 : 45,
    url: d.platform === "youtube_video" ? "/mock-media/synthetic-draft-16x9.mp4" : "/mock-media/synthetic-draft-9x16.mp4",
    urlExpiresAt: "2099-01-01T00:00:00Z",
  };
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
    Object.assign(item, { status: "checking", askedAt: undefined, declined: undefined, brandNote: undefined, askable: undefined });
  }
  onChange(creatorView(d));

  setTimeout(() => {
    if (outcome) return finishDemoRun(d, before, outcome, onChange);
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
    onChange(creatorView(d));
  }, delayMs);
}

/** RW-FR-28: the demo run's results, with synthetic evidence for every item checked. */
function finishDemoRun(d: Deliverable, before: Map<string, Deliverable["items"][number]["status"]>, outcome: DemoOutcome, onChange: (d: Deliverable) => void) {
  d.state = "results";
  d.stages = undefined;
  d.checkStartedAt = undefined;
  const checked = d.items.filter((i) => i.status === "checking");
  const unsure = outcome === "one_unsure" ? (checked.find((i) => i.kind === "shown") ?? checked[0]) : undefined;
  checked.forEach((item, n) => {
    const now = item === unsure ? "unsure" : "passed";
    const evidence = item.evidence ?? { ...EVIDENCE[item.kind], startSec: 8 + n * 20 };
    Object.assign(item, { previousStatus: before.get(item.id), status: now, askable: now === "unsure", evidence });
  });
  for (const item of d.items) if (item.status === "at_live_check") item.evidence ??= EVIDENCE[item.kind];
  if (!unsure) {
    d.state = "fully_passing";
    d.reviewWindowEndsAt = new Date(Date.now() + WINDOW_MS).toISOString();
  }
  onChange(creatorView(d));
}
