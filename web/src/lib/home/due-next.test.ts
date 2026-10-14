import { describe, expect, test } from "vitest";
import { dueNext } from "./due-next";
import { aPayment } from "./test-rows";

const now = new Date("2026-10-20T09:00:00.000Z"); // Tue 20 Oct
const held = (id: string, deadline: string, receivedMinor = 76000, p = {}) =>
  aPayment({ deliverableId: id, dealId: `deal_${id}`, stage: "held", deadline, receivedMinor, feeMinor: 4000, payout: undefined, paidAt: undefined, publishedAt: undefined, ...p });

describe("HM-FR-27 (1.8) what's due next", () => {
  test("held posts not yet published, soonest deadline first, with what the creator receives and a link", () => {
    const v = dueNext([held("b", "2026-10-23T22:59:00.000Z", 147250, { brandName: "Maple & Moss", platform: "instagram_reel" }), held("a", "2026-10-21T22:59:00.000Z", 42750, { brandName: "Pine & Co", platform: "youtube_short" })], now, "UTC");
    expect(v.rows).toEqual([
      { brand: "Pine & Co", post: "Short", due: "Due tomorrow", soon: true, amount: "$427.50", href: "/deals/deal_a/deliverables/a" },
      { brand: "Maple & Moss", post: "Reel", due: "Due Fri 23 Oct", soon: false, amount: "$1,472.50", href: "/deals/deal_b/deliverables/b" },
    ]);
    expect(v.more).toBe(0);
  });

  test("a post already published, captured, paid or released is not due", () => {
    const rows = [
      held("live", "2026-10-21T22:59:00.000Z", 76000, { publishedAt: "2026-10-19T10:00:00.000Z" }),
      aPayment({ deliverableId: "paid" }),
      aPayment({ deliverableId: "way", stage: "captured", paidAt: undefined }),
      aPayment({ deliverableId: "gone", stage: "released" }),
    ];
    expect(dueNext(rows, now, "UTC")).toEqual({ rows: [], more: 0 });
  });

  test("three at most, then how many more", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id, i) => held(id, `2026-10-2${2 + i}T22:59:00.000Z`));
    const v = dueNext(rows, now, "UTC");
    expect(v.rows.map((r) => r.href.split("/").at(-1))).toEqual(["a", "b", "c"]);
    expect(v.more).toBe(2);
  });

  test("today and tomorrow are the creator's own days", () => {
    // 23:30 UTC on the 20th is already the 21st in Lagos (UTC+1).
    const late = new Date("2026-10-20T23:30:00.000Z");
    expect(dueNext([held("a", "2026-10-21T22:59:00.000Z")], late, "Africa/Lagos").rows[0].due).toBe("Due today");
    expect(dueNext([held("a", "2026-10-21T22:59:00.000Z")], late, "UTC").rows[0].due).toBe("Due tomorrow");
  });
});
