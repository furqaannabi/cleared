import { describe, expect, test } from "vitest";
import { dealSteps, postStepLabel, stepLabel } from "./deal-steps";
import type { Deliverable } from "./types";

// Only the state matters to the steps.
const at = (state: Deliverable["state"]) => ({ state }) as Deliverable;

describe("DC-FR-33, DC-FR-34 (1.25) a payout on its way is never called paid", () => {
  test("the post's label says the payout is on its way; paid stays paid", () => {
    expect(stepLabel("captured")).toBe("Payout on its way");
    expect(postStepLabel({ state: "captured" })).toBe("Payout on its way");
    expect(stepLabel("paid")).toBe("Paid");
  });

  test("the phone summary says so too, while the stepper keeps the step's name", () => {
    const steps = dealSteps(at("captured"));
    expect(steps.summary).toBe("Step 7 of 7 · Payout on its way");
    expect(steps.items.at(-1)).toEqual({ label: "Paid", state: "current" });
  });

  test("other steps keep their names", () => {
    expect(dealSteps(at("published")).summary).toBe("Step 6 of 7 · Live check");
    expect(stepLabel("results")).toBe("Draft check");
  });
});
