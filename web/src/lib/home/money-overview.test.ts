import { describe, expect, test } from "vitest";
import { moneyOverview } from "./money-overview";
import { aPayment } from "./test-rows";

// The API gives what is received only once a hold is taken (AH-FR-06): a held post has its deal amount alone.
const held = aPayment({ deliverableId: "a", stage: "held", payout: undefined, paidAt: undefined, amountMinor: 120000, feeMinor: undefined, receivedMinor: undefined });
const sending = aPayment({ deliverableId: "b", stage: "captured", payout: { state: "sending" }, paidAt: undefined, receivedMinor: 50000 });

describe("HM-FR-05 the three totals, in what the creator receives", () => {
  test("on its way and paid each add the API's received amounts and count their posts", () => {
    const o = moneyOverview([held, sending, aPayment({ deliverableId: "c" }), aPayment({ deliverableId: "d", receivedMinor: 99750 })]);
    expect(o.onItsWay).toEqual({ text: "$500.00", posts: "1 post" });
    expect(o.paid).toEqual({ text: "$1,757.50", posts: "2 posts" });
  });
});

describe("HM-FR-05 (1.4) held, before the fee, and a post never paid", () => {
  test("held for you adds the held posts' deal amounts, and says they are before Sponing's fee", () => {
    const o = moneyOverview([held, aPayment({ deliverableId: "e", stage: "held", payout: undefined, paidAt: undefined, amountMinor: 45000, feeMinor: undefined, receivedMinor: undefined })]);
    expect(o.held).toEqual({ text: "$1,650.00", posts: "2 posts · before Sponing’s fee" });
  });

  test("a post approved but never paid counts in no total", () => {
    const o = moneyOverview([aPayment({ stage: "approved_not_paid", payout: undefined, paidAt: undefined, feeMinor: undefined, receivedMinor: undefined })]);
    expect([o.held.text, o.onItsWay.text, o.paid.text]).toEqual(["$0.00", "$0.00", "$0.00"]);
  });
});

describe("HM-FR-06 what's stuck", () => {
  const stuck = (id: string, state: "failed" | "unclaimed", brandName = "Juniper & Salt") =>
    aPayment({ dealId: "deal_j", deliverableId: id, brandName, platform: "instagram_reel", stage: "captured", payout: { state }, paidAt: undefined });

  test("a failed or unclaimed payout is named with why, linking to its post; a sending one is not", () => {
    const o = moneyOverview([stuck("r1", "failed"), stuck("r2", "unclaimed", "Glow Theory"), sending]);
    expect(o.stuck.lines).toEqual([
      { text: "Juniper & Salt · Reel: the payout didn’t go through.", href: "/deals/deal_j/deliverables/r1" },
      { text: "Glow Theory · Reel: PayPal is waiting for you to accept it.", href: "/deals/deal_j/deliverables/r2" },
    ]);
    expect(o.stuck.more).toBe(0);
  });

  test("past three, the rest are counted", () => {
    const o = moneyOverview(["a", "b", "c", "d", "e"].map((id) => stuck(id, "failed")));
    expect(o.stuck.lines).toHaveLength(3);
    expect(o.stuck.more).toBe(2);
  });
});
