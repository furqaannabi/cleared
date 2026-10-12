import { describe, expect, test } from "vitest";
import { moneyOverview } from "./money-overview";
import { aPayment } from "./test-rows";

const held = aPayment({ deliverableId: "a", stage: "held", payout: undefined, paidAt: undefined, receivedMinor: 114000 });
const sending = aPayment({ deliverableId: "b", stage: "captured", payout: { state: "sending" }, paidAt: undefined, receivedMinor: 50000 });

describe("HM-FR-05 the three totals, in what the creator receives", () => {
  test("held, on its way and paid each add the API's received amounts and count their posts", () => {
    const o = moneyOverview([held, sending, aPayment({ deliverableId: "c" }), aPayment({ deliverableId: "d", receivedMinor: 99750 })]);
    expect(o.held).toEqual({ text: "$1,140.00", posts: "1 post" });
    expect(o.onItsWay).toEqual({ text: "$500.00", posts: "1 post" });
    expect(o.paid).toEqual({ text: "$1,757.50", posts: "2 posts" });
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
