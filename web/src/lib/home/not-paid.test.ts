import { describe, expect, test } from "vitest";
import { notPaid } from "./not-paid";
import type { PaymentRow } from "./payment-row";
import { aPayment } from "./test-rows";

const ended = (p: Partial<PaymentRow>) =>
  aPayment({ stage: "released", feeMinor: undefined, receivedMinor: undefined, payout: undefined, paidAt: undefined, releasedBecause: "deadline", releasedAt: "2026-10-03T23:00:00.000Z", ...p });

describe("HM-FR-29 (1.8) the posts that were not paid", () => {
  test("released and approved-not-paid posts, newest first by when the hold ended, with the date, the post, the deal amount and a link", () => {
    const rows = [
      ended({ deliverableId: "old", dealId: "deal_old", releasedAt: "2026-09-12T10:00:00.000Z" }),
      aPayment(),
      aPayment({ deliverableId: "held", stage: "held" }),
      ended({ deliverableId: "new", dealId: "deal_new", brandName: "Pine & Co", amountMinor: 45000, releasedAt: "2026-10-03T23:00:00.000Z" }),
    ];
    const v = notPaid(rows, "UTC");
    expect(v.map((r) => r.id)).toEqual(["new", "old"]);
    expect(v[0]).toEqual({ id: "new", date: "3 Oct 2026", brand: "Pine & Co", post: "YouTube video", amount: "$450.00", why: "The deadline passed before you posted", href: "/deals/deal_new/deliverables/new" });
  });

  test("none when every post was paid or is still under way", () => {
    expect(notPaid([aPayment(), aPayment({ deliverableId: "h", stage: "held" })], "UTC")).toEqual([]);
  });
});

describe("HM-FR-30 (1.8) why, in a few words", () => {
  const why = (p: Partial<PaymentRow>) => notPaid([ended({ brandName: "Glow Theory", ...p })], "UTC")[0].why;

  test.each([
    ["deadline", "The deadline passed before you posted"],
    ["day_28", "The hold ran out on day 28"],
    ["fix_window_ended", "Your live post still failed when the fix window ended"],
    ["not_accepted", "Glow Theory didn’t accept the post in time"],
    ["ruled_not_to_pay", "Sponing decided not to pay"],
    ["hold_not_confirmed", "PayPal couldn’t confirm the hold"],
  ] as const)("%s", (releasedBecause, words) => {
    expect(why({ releasedBecause })).toBe(words);
  });

  test("a cancel says who", () => {
    expect(why({ releasedBecause: "cancelled", cancelledBy: "creator" })).toBe("You cancelled the post");
    expect(why({ releasedBecause: "cancelled", cancelledBy: "brand" })).toBe("Glow Theory cancelled the post");
  });

  test("approved, not paid reads the same whatever ended the hold", () => {
    expect(why({ stage: "approved_not_paid", releasedBecause: "day_28" })).toBe("Approved, but PayPal didn’t let Sponing collect it");
    expect(why({ stage: "approved_not_paid", releasedBecause: "deadline" })).toBe("Approved, but PayPal didn’t let Sponing collect it");
  });

  test("the date is the creator's own day", () => {
    // 23:30 UTC on 3 Oct is already 4 Oct in Lagos.
    expect(notPaid([ended({ releasedAt: "2026-10-03T23:30:00.000Z" })], "Africa/Lagos")[0].date).toBe("4 Oct 2026");
  });
});
