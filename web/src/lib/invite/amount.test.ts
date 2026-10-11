import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount, sumAmounts } from "./amount";

describe("parseAmount (IN-FR-05)", () => {
  it("turns whole and two-place dollars into a two-place decimal string", () => {
    expect(parseAmount("1200")).toEqual({ ok: true, value: "1200.00" });
    expect(parseAmount("1,200.5")).toEqual({ ok: true, value: "1200.50" });
    expect(parseAmount(" $450.00 ")).toEqual({ ok: true, value: "450.00" });
  });

  it("refuses empty, three places, letters and negatives", () => {
    const shape = "Enter an amount in dollars, like 1200 or 1200.50";
    expect(parseAmount("")).toEqual({ ok: false, message: "Add an amount" });
    expect(parseAmount("12.345")).toEqual({ ok: false, message: shape });
    expect(parseAmount("twelve")).toEqual({ ok: false, message: shape });
    expect(parseAmount("-5")).toEqual({ ok: false, message: shape });
  });

  it("1.3: one post is $20.00 to $10,000.00", () => {
    const least = "The least one post can be is $20.00.";
    const most = "The most one post can be is $10,000.00.";
    expect(parseAmount("0")).toEqual({ ok: false, message: least });
    expect(parseAmount("19.99")).toEqual({ ok: false, message: least });
    expect(parseAmount("20")).toEqual({ ok: true, value: "20.00" });
    expect(parseAmount("10,000.00")).toEqual({ ok: true, value: "10000.00" });
    expect(parseAmount("10000.01")).toEqual({ ok: false, message: most });
    expect(parseAmount("99999999999")).toEqual({ ok: false, message: most });
  });
});

describe("formatAmount and sumAmounts (IN-FR-08)", () => {
  it("shows dollars with thousands separators", () => {
    expect(formatAmount("1200.00")).toBe("$1,200.00");
    expect(formatAmount("9999999.99")).toBe("$9,999,999.99");
    expect(formatAmount("0.50")).toBe("$0.50");
  });

  it("adds amounts in whole cents, without float drift", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["1200.00", "450.00"])).toBe("1650.00");
  });
});
