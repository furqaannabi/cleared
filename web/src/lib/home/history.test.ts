import { describe, expect, test } from "vitest";
import { historyRows, paymentsCsv } from "./history";
import { aPayment } from "./test-rows";

const kora = aPayment();
const tide = aPayment({ dealId: "deal_tide", deliverableId: "del_tide_short", brandName: "Tide Studio", platform: "youtube_short", amountMinor: 105000, feeMinor: 5250, receivedMinor: 99750, paidAt: "2026-09-24T10:00:00.000Z", payout: { state: "paid", reference: "8RT4410ZPA", at: "2026-09-24T10:00:00.000Z" }, holdReference: "3MV88201QD" });

describe("HM-FR-16 one row per paid post", () => {
  test("only paid posts, newest first, with the API's amounts and both references", () => {
    const rows = historyRows([tide, aPayment({ stage: "captured", payout: { state: "sending" }, paidAt: undefined }), kora], "Europe/London");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "9 Oct 2026",
      brand: "Kora Audio",
      post: "YouTube video",
      amount: "$800.00",
      fee: "$40.00",
      received: "$760.00",
      payoutReference: "5UX0294KQ1",
      holdReference: "7HK21934LM",
      href: "/deals/deal_kora/deliverables/del_kora_video",
    });
    expect(rows[1].brand).toBe("Tide Studio");
  });
});

describe("HM-FR-19 the CSV", () => {
  test("a header and one line per paid post, amounts as plain decimals, dates as YYYY-MM-DD", () => {
    const csv = paymentsCsv(historyRows([kora, tide], "UTC"));
    expect(csv.split("\r\n")).toEqual([
      "Date paid,Brand,Post,Deal amount,Fee,Received,Payout reference,Hold reference",
      "2026-10-09,Kora Audio,YouTube video,800.00,40.00,760.00,5UX0294KQ1,7HK21934LM",
      "2026-09-24,Tide Studio,Short,1050.00,52.50,997.50,8RT4410ZPA,3MV88201QD",
      "",
    ]);
  });

  test.each([
    ["=HYPERLINK(1)", "'=HYPERLINK(1)"],
    ["+Brand", "'+Brand"],
    ["-Brand", "'-Brand"],
    ["@Brand", "'@Brand"],
    ["\tBrand", "'\tBrand"],
    ["Pine, & Co", '"Pine, & Co"'],
    ['The "Best" Co', '"The ""Best"" Co"'],
    ["Line\nBreak", '"Line\nBreak"'],
  ])("a brand named %j is written safely as %j", (brandName, cell) => {
    const csv = paymentsCsv(historyRows([aPayment({ brandName })], "UTC"));
    expect(csv.split("\r\n")[1].split(",YouTube video")[0].slice("2026-10-09,".length)).toBe(cell);
  });

  test("the file is named with today's date", async () => {
    const { csvFileName } = await import("./history");
    expect(csvFileName(new Date("2026-10-12T09:00:00.000Z"), "UTC")).toBe("cleared-payments-2026-10-12.csv");
  });
});
