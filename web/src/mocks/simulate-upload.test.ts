import { afterEach, expect, test, vi } from "vitest";
import type { Deliverable } from "@/lib/deliverable/types";
import { findDeliverable } from "./store";
import { simulateUpload } from "./simulate-upload";

afterEach(() => vi.useRealTimers());

// DC-FR-45: mocks only. A new draft shows Checking, then a new run; asks are cancelled (DC-BR-04).
test("simulates a new draft check: Checking, then the new results", async () => {
  vi.useFakeTimers();
  const d = findDeliverable("del_glow_video")!;
  Object.assign(d.items.find((i) => i.id === "it_6")!, { status: "waiting_for_brand", askedAt: "2026-10-06T10:00:00Z" });

  const seen: Deliverable[] = [];
  simulateUpload("del_glow_video", (next) => seen.push(structuredClone(next)), 3000);

  expect(seen[0].state).toBe("checking");
  expect(seen[0].items.find((i) => i.id === "it_5")!.status).toBe("checking");
  expect(seen[0].items.find((i) => i.id === "it_7")!.status).toBe("at_live_check");

  await vi.advanceTimersByTimeAsync(3000);
  const results = seen[1];
  expect(results.state).toBe("results");
  expect(results.items.find((i) => i.id === "it_5")).toMatchObject({ status: "passed", previousStatus: "fix_needed" });
  expect(results.items.find((i) => i.id === "it_6")).toMatchObject({ status: "unsure", askable: true });
  expect(results.items.find((i) => i.id === "it_6")!.askedAt).toBeUndefined();
});

// RW-FR-28: mocks only. The demo can be told the run's outcome, so the brand's side can be shown from any post.
test("a draft that passes every item opens the brand's 48-hour window, with evidence for each item", async () => {
  vi.useFakeTimers();
  const seen: Deliverable[] = [];
  simulateUpload("del_juniper_reel", (next) => seen.push(structuredClone(next)), 10, "passes");
  await vi.advanceTimersByTimeAsync(10);
  const d = seen[1];
  expect(d.state).toBe("fully_passing");
  expect(d.items.map((i) => i.status)).toEqual(["passed", "passed", "passed", "at_live_check"]);
  expect(d.items.every((i) => i.evidence)).toBe(true);
  expect(Date.parse(d.reviewWindowEndsAt!) - Date.now()).toBe(48 * 3_600_000);
});

test("a draft with one Unsure item stays at results, the Unsure one askable", async () => {
  vi.useFakeTimers();
  const seen: Deliverable[] = [];
  simulateUpload("del_juniper_reel", (next) => seen.push(structuredClone(next)), 10, "one_unsure");
  await vi.advanceTimersByTimeAsync(10);
  const d = seen[1];
  expect(d.state).toBe("results");
  expect(d.items.filter((i) => i.status === "unsure")).toHaveLength(1);
  expect(d.items.find((i) => i.status === "unsure")?.askable).toBe(true);
});

test("RW-FR-23, DC-BR-04: a first draft gets a video; a new draft clears the brand's objections and approval", async () => {
  vi.useFakeTimers();
  const d = findDeliverable("del_juniper_video")!;
  Object.assign(d, { state: "objected", objectedAt: "2026-10-08T10:00:00Z", reviewWindowEndsAt: undefined, draft: undefined });
  Object.assign(d.items.find((i) => i.id === "jv_3")!, { status: "objected_by_brand", brandNote: "Slower." });
  const seen: Deliverable[] = [];
  simulateUpload("del_juniper_video", (next) => seen.push(structuredClone(next)), 10, "passes");
  await vi.advanceTimersByTimeAsync(10);
  const after = seen[1];
  expect(after.draft?.url).toMatch(/^\/mock-media\//);
  expect(after.objectedAt).toBeUndefined();
  expect(after.items.find((i) => i.id === "jv_3")).toMatchObject({ status: "passed" });
  expect(after.items.find((i) => i.id === "jv_3")?.brandNote).toBeUndefined();
});
