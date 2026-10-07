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
