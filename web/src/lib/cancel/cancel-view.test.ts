import { describe, expect, test } from "vitest";
import type { Deliverable } from "@/lib/deliverable/types";
import { cancelView, creatorCancelInfo } from "./cancel-view";

const post = (o: Partial<Deliverable>): Deliverable => ({
  id: "del_1",
  brandName: "Juniper & Salt",
  platform: "instagram_reel",
  state: "results",
  deadline: "2026-10-20T22:59:00Z",
  creatorTimeZone: "UTC",
  items: [],
  hold: { amountMinor: 60000, currency: "USD", reference: "DEMO-R", heldAt: "2026-10-05T10:00:00Z", stage: "held" },
  payoutEmail: "ada@example.com",
  cancel: { allowed: true },
  ...o,
});
const creator = (o: Partial<Deliverable>) => cancelView(creatorCancelInfo(post(o)), { side: "creator", creatorName: "Ada Okafor" });
const brand = (o: Partial<Deliverable>) => cancelView(creatorCancelInfo(post(o)), { side: "brand", creatorName: "Ada Okafor" });

describe("CN-FR-01, CN-FR-03 the button, or why not", () => {
  test("allowed: the button, no line", () => {
    expect(creator({})).toMatchObject({ button: "Cancel this post", why: null });
  });
  test("a go-ahead running: no button; the line names who has it", () => {
    expect(creator({ cancel: { allowed: false, reason: "go_ahead_running" } })).toMatchObject({ button: null, why: "You can’t cancel now: you have the go-ahead to post." });
    expect(brand({ cancel: { allowed: false, reason: "go_ahead_running" } }).why).toBe("You can’t cancel now: Ada Okafor has the go-ahead to post.");
  });
  test("published: no button; finished: nothing at all", () => {
    expect(creator({ cancel: { allowed: false, reason: "published" } })).toMatchObject({ button: null, why: "You can’t cancel now: this post is published." });
    expect(creator({ cancel: { allowed: false, reason: "finished" } })).toMatchObject({ button: null, why: null });
    expect(creator({ cancel: undefined })).toMatchObject({ button: null, why: null });
  });
});

describe("CN-FR-04, CN-FR-05, CN-FR-07 the card turned over (design B)", () => {
  test("the creator: where the money would go, the amount, final, and a note for the brand", () => {
    expect(creator({}).confirm).toEqual({
      heading: "Cancel this post?",
      goes: "Would go back to Juniper & Salt",
      amount: "$600.00",
      say: "Their hold is released and the Reel closes.",
      final: "This can’t be undone.",
      noteLabel: "Add a note for Juniper & Salt (optional)",
      confirm: "Cancel the post",
    });
  });
  test("the brand: the money comes back to it; the note is for the creator", () => {
    expect(brand({}).confirm).toMatchObject({ goes: "Would come back to you", say: "Your hold is released and the Reel closes.", noteLabel: "Add a note for Ada Okafor (optional)" });
  });
});
