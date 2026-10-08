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

describe("PP-FR-25 each post's line after Approved", () => {
  test("posting, live check, the brand's decisions first, with Cleared, paid", () => {
    const lines = postLines(
      deal([
        post("a", { state: "posting", postBy: "2026-10-10T14:00:00Z" }),
        post("b", { state: "live_check" }),
        post("c", { state: "accept", endsAt: "2026-10-10T08:00:00Z" }),
        post("d", { state: "confirm", endsAt: "2026-10-09T08:00:00Z" }),
        post("e", { state: "with_cleared" }),
        post("f", { state: "taken", amount: "350.00" }),
        post("g", { state: "approved_not_paid" }),
      ]),
      NOW,
    );
    expect(lines.map((l) => [l.deliverableId, l.text, l.action?.text ?? null])).toEqual([
      ["d", "Confirm the post · 20h 0m left", "Review post"],
      ["c", "Accept the post? · 44h 0m left", "Review post"],
      ["a", "Ada Okafor has the go-ahead · posts by 10 Oct", "View draft"],
      ["b", "Posted · checking the live post", "View post"],
      ["e", "A person at Cleared is deciding", "View post"],
      ["f", "Paid · $350.00 taken", "View post"],
      ["g", "Approved, not paid", null],
    ]);
  });

  test("CN-FR-12: a cancelled post reads Cancelled, with who cancelled it", () => {
    const by = (who: "brand" | "creator") => deal([{ ...post("a", { state: "released" }), cancelled: { by: who, at: "2026-10-09T10:00:00Z" } }]);
    expect(postLines(by("brand"), new Date("2026-10-09T12:00:00Z"))[0].text).toBe("Cancelled by you");
    expect(postLines(by("creator"), new Date("2026-10-09T12:00:00Z"))[0].text).toBe("Cancelled by Ada Okafor");
  });
});
