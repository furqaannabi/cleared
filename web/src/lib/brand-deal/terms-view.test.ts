import { describe, expect, test } from "vitest";
import type { BrandDeal } from "./types";
import { brandTermsView, noteTarget } from "./terms-view";

const deal = (over: Partial<BrandDeal> = {}): BrandDeal => ({
  dealId: "deal_maple",
  creatorName: "Ada Okafor",
  brandName: "Maple & Moss",
  step: "waiting_for_brand",
  version: 1,
  posts: [
    { deliverableId: "v", platform: "youtube_video", amount: "1200.00", deadlineDays: 14, hold: { state: "not_started" } },
    { deliverableId: "r", platform: "instagram_reel", amount: "450.00", deadlineDays: 10, hold: { state: "not_started" } },
  ],
  items: [
    { id: "i1", deliverableId: "v", name: "Say the code MOSS10", briefLine: 2, addedByCreator: false },
    { id: "i2", deliverableId: "v", name: "Link maplemoss.com/ada in the description", addedByCreator: true },
    { id: "i3", deliverableId: "r", name: "Mention Maple & Moss in the first 10 seconds", briefLine: 3, addedByCreator: false },
  ],
  brief: [
    { number: 1, text: "Thanks for partnering with Maple & Moss!" },
    { number: 2, text: "Say and show the code MOSS10." },
    { number: 3, text: "Mention us early in the Reel." },
    { number: 4, text: "Keep it cosy." },
  ],
  answers: [
    { briefLine: 3, kind: "suggestion", text: "In the first 10 seconds" },
    { briefLine: 4, kind: "left_out" },
  ],
  notes: [],
  ...over,
});

describe("CH-FR-07 where an item came from", () => {
  test("an item quotes its brief line; one the creator added says so", () => {
    const [video] = brandTermsView(deal()).posts;
    expect(video.items[0].source).toEqual({ kind: "brief", line: "Say and show the code MOSS10." });
    expect(video.items[1].source).toEqual({ kind: "added" });
  });
});

describe("CH-FR-08 what the creator decided", () => {
  test("an item from a line the creator answered carries the line and their reading", () => {
    const [, reel] = brandTermsView(deal()).posts;
    expect(reel.items[0].reading).toEqual({ line: "Mention us early in the Reel.", answer: "In the first 10 seconds" });
  });

  test("an item from a line with no answer has no reading", () => {
    const [video] = brandTermsView(deal()).posts;
    expect(video.items[0].reading).toBeUndefined();
  });
});

describe("CH-FR-09 not on the checklist", () => {
  test("lists each brief line no item cites, once, marking the ones the creator left out", () => {
    expect(brandTermsView(deal()).notOnChecklist).toEqual([
      { number: 1, text: "Thanks for partnering with Maple & Moss!", leftOut: false },
      { number: 4, text: "Keep it cosy.", leftOut: true },
    ]);
  });

  test("a blank line isn't listed", () => {
    const view = brandTermsView(deal({ brief: [...deal().brief, { number: 5, text: "  " }] }));
    expect(view.notOnChecklist.map((l) => l.number)).toEqual([1, 4]);
  });
});

describe("CH-FR-05 the terms", () => {
  test("the total adds every post in whole cents", () => {
    const posts = deal().posts.map((p, i) => ({ ...p, amount: ["0.10", "0.20"][i] }));
    expect(brandTermsView(deal({ posts })).total).toBe("0.30");
  });
});

describe("CH-FR-14 the agree summary", () => {
  test("names the number of posts and the total", () => {
    expect(brandTermsView(deal()).summary).toBe("You’re agreeing to the checklist for 2 posts, $1,650.00 in total (one hold per post), and how payment works.");
  });

  test("says post, not posts, for one", () => {
    expect(brandTermsView(deal({ posts: [deal().posts[0]] })).summary).toBe(
      "You’re agreeing to the checklist for 1 post, $1,200.00 in total (one hold per post), and how payment works.",
    );
  });
});

describe("CH-FR-13 the new version", () => {
  test("marks changed items and a post's changed amount or deadline", () => {
    const items = deal().items.map((i) => (i.id === "i1" ? { ...i, changed: true } : i));
    const posts = deal().posts.map((p, n) => (n === 1 ? { ...p, changed: ["amount" as const] } : p));
    const view = brandTermsView(deal({ version: 2, items, posts }));
    expect(view.posts[0].items.map((i) => i.changed)).toEqual([true, false]);
    expect(view.posts[1].changed).toEqual(["amount"]);
    expect(view.posts[0].changed).toEqual([]);
  });
});

describe("CH-FR-12, CH-FR-13 what a note is about, in words", () => {
  test("names the item and its post, the line, the post's amount or deadline, or the deal", () => {
    const d = deal();
    expect(noteTarget(d, { kind: "item", itemId: "i1" })).toBe("Say the code MOSS10 (YouTube video)");
    expect(noteTarget(d, { kind: "line", briefLine: 4 })).toBe("“Keep it cosy.”");
    expect(noteTarget(d, { kind: "amount", deliverableId: "r" })).toBe("the amount for the Instagram Reel");
    expect(noteTarget(d, { kind: "deadline", deliverableId: "v" })).toBe("the deadline for the YouTube video");
    expect(noteTarget(d, { kind: "deal" })).toBe("this deal");
  });

  test("something no longer on the deal is named plainly", () => {
    expect(noteTarget(deal(), { kind: "item", itemId: "gone" })).toBe("an item that was removed");
  });
});
