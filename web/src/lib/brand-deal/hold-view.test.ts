import { describe, expect, test } from "vitest";
import { creatorHoldLine, holdLine, holdsSummary } from "./hold-view";
import type { Hold } from "./types";

const line = (hold: Hold) => holdLine(hold, { creator: "Ada Okafor", amount: "1200.00" });

describe("CH-FR-17, CH-FR-18 each hold's state, from the API", () => {
  test("not started: the button is on, nothing to say", () => {
    expect(line({ state: "not_started" })).toEqual({ held: false, message: null, problem: false, canApprove: true });
  });

  test("closed and declined say nothing was taken, and the button comes back", () => {
    expect(line({ state: "closed" })).toEqual({ held: false, message: "You closed PayPal. Nothing was held.", problem: false, canApprove: true });
    expect(line({ state: "declined" })).toEqual({
      held: false,
      message: "PayPal didn’t approve this hold. Nothing was taken. Try again, or pick another way to pay in PayPal.",
      problem: true,
      canApprove: true,
    });
  });

  test("CH-BR-05: pending and unknown keep the button off, so nobody approves twice", () => {
    expect(line({ state: "pending" })).toMatchObject({ held: false, message: "Checking with PayPal…", canApprove: false });
    expect(line({ state: "unknown" })).toMatchObject({
      held: false,
      message: "We couldn’t confirm this with PayPal yet. Don’t approve it again; this page will update.",
      canApprove: false,
    });
  });

  test("held shows the amount, the PayPal reference and the date the creator posts by", () => {
    expect(line({ state: "held", reference: "DEMO-8AB1", deadline: "2026-10-23" })).toEqual({
      held: true,
      message: "Held · $1,200.00 · PayPal ref DEMO-8AB1 · Ada Okafor posts by 23 Oct",
      problem: false,
      canApprove: false,
    });
  });
});

describe("CH-FR-17, CH-FR-19 the count", () => {
  test("counts held posts, and says when all are held", () => {
    const hold = (state: Hold["state"]): Hold => ({ state });
    expect(holdsSummary([hold("held"), hold("declined"), hold("pending")], "Ada Okafor")).toEqual({ heading: "1 of 3 held", allHeld: null, waiting: true });
    expect(holdsSummary([hold("held"), hold("held")], "Ada Okafor")).toEqual({ heading: "2 of 2 held", allHeld: "All held. Ada Okafor is making the posts.", waiting: false });
  });
});

describe("CH-FR-25 a hold, for the creator", () => {
  test("held: the amount, the reference and the date to post by", () => {
    expect(creatorHoldLine({ state: "held", reference: "DEMO-8AB1", deadline: "2026-10-23" }, { brand: "Maple & Moss", amount: "1200.00" })).toEqual({
      held: true,
      text: "Held · $1,200.00 · PayPal ref DEMO-8AB1 · Post by 23 Oct",
    });
  });

  test("anything else says who has to act and what the creator can do meanwhile", () => {
    expect(creatorHoldLine({ state: "declined" }, { brand: "Maple & Moss", amount: "450.00" })).toEqual({
      held: false,
      text: "Waiting for Maple & Moss to approve this hold. You can start on the posts that are held.",
    });
  });
});
