import { afterEach, expect, test, vi } from "vitest";
import { findDeliverable, resetMockData } from "./store";

afterEach(() => {
  vi.useRealTimers();
  resetMockData();
});

test("DC-FR-07: the seeded review window is still open whenever the demo is reset", () => {
  vi.useFakeTimers({ now: Date.parse("2026-11-12T09:00:00Z"), toFake: ["Date"] });
  resetMockData();
  expect(findDeliverable("del_nb_short")?.state).toBe("fully_passing");
});
