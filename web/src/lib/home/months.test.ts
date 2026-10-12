import { describe, expect, test } from "vitest";
import { figureTrends, paidEachMonth } from "./months";
import { aPayment } from "./test-rows";

const NOW = new Date("2026-10-12T09:00:00.000Z");
const paid = (paidAt: string, receivedMinor = 76000) => aPayment({ paidAt, receivedMinor });

describe("HM-FR-12 paid each month", () => {
  test("the last six months, each what was received, the current month marked so far", () => {
    const months = paidEachMonth([paid("2026-10-09T12:00:00.000Z"), paid("2026-09-11T12:00:00.000Z", 133000), paid("2026-09-24T12:00:00.000Z", 99750)], NOW, "Europe/London");
    expect(months.map((m) => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(months[4]).toMatchObject({ amountMinor: 232750, text: "$2,327.50", current: false });
    expect(months[5]).toMatchObject({ amountMinor: 76000, current: true, spoken: "October so far: $760.00" });
    expect(months[0]).toMatchObject({ amountMinor: 0, spoken: "May: $0.00" });
  });

  test("a payment is in the month of the creator's time zone", () => {
    const months = paidEachMonth([paid("2026-09-30T20:00:00.000Z")], NOW, "Asia/Tokyo");
    expect(months[5].amountMinor).toBe(76000);
  });

  test("months run back across the year", () => {
    const months = paidEachMonth([paid("2026-12-15T12:00:00.000Z")], new Date("2027-02-03T12:00:00.000Z"), "UTC");
    expect(months.map((m) => m.label)).toEqual(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]);
    expect(months[3].amountMinor).toBe(76000);
  });

  test("posts not yet paid are not counted", () => {
    const months = paidEachMonth([aPayment({ stage: "captured", paidAt: undefined, payout: { state: "sending" } })], NOW, "UTC");
    expect(months.every((m) => m.amountMinor === 0)).toBe(true);
  });
});

describe("HM-FR-13 trend lines", () => {
  const post = (month: string, onTime: boolean) =>
    aPayment({ publishedAt: `2026-${month}-10T12:00:00.000Z`, deadline: `2026-${month}-${onTime ? "20" : "05"}T12:00:00.000Z`, paidAt: `2026-${month}-12T12:00:00.000Z` });

  test("each figure by month, once three or more months have posts to count", () => {
    const t = figureTrends([post("08", true), post("08", true), post("09", false), post("10", true)], "UTC");
    expect(t.onTime?.map((p) => p.spoken)).toEqual(["August 2 of 2", "September 0 of 1", "October 1 of 1"]);
    expect(t.onTime?.map((p) => p.value)).toEqual([1, 0, 1]);
  });

  test("fewer than three months gives no line", () => {
    expect(figureTrends([post("09", true), post("10", true)], "UTC").onTime).toBeUndefined();
  });
});
