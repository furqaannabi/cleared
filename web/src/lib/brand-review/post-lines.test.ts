import { describe, expect, test } from "vitest";
import type { BrandDeal, BrandPost } from "@/lib/brand-deal/types";
import { postLines } from "./post-lines";

const NOW = new Date("2026-10-08T12:00:00Z");
const post = (deliverableId: string, review: BrandPost["review"], platform: BrandPost["platform"] = "youtube_video"): BrandPost => ({
  deliverableId,
  platform,
  amount: "100.00",
  deadlineDays: 7,
  hold: { state: "held", reference: "DEMO", deadline: "2026-10-23" },
  ...(review ? { review } : {}),
});
const deal = (posts: BrandPost[]) => ({ dealId: "deal_1", creatorName: "Ada Okafor", posts }) as Pick<BrandDeal, "dealId" | "creatorName" | "posts">;

describe("RW-FR-01, RW-FR-02 each post's draft on the brand's deal page", () => {
  test("says where each draft stands, with Review draft when the brand has something to do", () => {
    const lines = postLines(
      deal([
        post("a", { state: "nothing_yet" }),
        post("b", { state: "asked", count: 2 }),
        post("c", { state: "window", endsAt: "2026-10-09T19:12:00Z" }),
        post("d", { state: "objected", count: 1 }),
        post("e", { state: "approved" }),
        post("f", { state: "released" }),
      ]),
      NOW,
    );
    expect(lines.map((l) => [l.deliverableId, l.text, l.action?.text ?? null, l.action?.style ?? null])).toEqual([
      ["c", "Draft ready for your review · 31h 12m left", "Review draft", "primary"],
      ["b", "Ada Okafor asked you about 2 items", "Review draft", "outline"],
      ["a", "Ada Okafor is working on the draft · Ada Okafor posts by 23 Oct", null, null],
      ["d", "You asked Ada Okafor to fix 1 item · Waiting for a new draft", "View draft", "link"],
      ["e", "Approved · Ada Okafor posts by 23 Oct", null, null],
      ["f", "The hold came back to you", null, null],
    ]);
    expect(lines[0].action?.href).toBe("/brand/deals/deal_1/deliverables/c");
    expect(lines.filter((l) => l.needsYou).map((l) => l.deliverableId)).toEqual(["c", "b"]);
  });

  test("the window ending soonest comes first; a post without a draft check yet has no line", () => {
    const lines = postLines(
      deal([post("x", undefined), post("late", { state: "window", endsAt: "2026-10-10T12:00:00Z" }), post("soon", { state: "window", endsAt: "2026-10-08T13:00:00Z" })]),
      NOW,
    );
    expect(lines.map((l) => l.deliverableId)).toEqual(["soon", "late"]);
  });
});
