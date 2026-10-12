import { describe, expect, test } from "bun:test";
import type { MoneyView } from "../money/view";
import { paymentRow } from "./history";

const at = (iso: string) => new Date(iso);
const post = { dealId: "deal-1", deliverableId: "post-1", brandName: "Glow Skincare", platform: "youtube_video" } as const;
const hold = { state: "held", reference: "HOLD-1", heldAt: at("2026-10-10T09:05:10Z"), deadlineAt: at("2026-10-24T22:59:00Z"), guaranteeEndsAt: at("2026-10-13T09:05:10Z"), day28At: at("2026-11-07T09:05:10Z") } as const;
const held: MoneyView = {
  stage: "held",
  status: null,
  amounts: { amount: "1200.00", fee: null, payout: null, currency: "USD" },
  hold,
  goAhead: { state: "none" },
  publishedAt: null,
  waitingOn: null,
  approval: null,
  capture: null,
  payout: null,
  release: null,
  closed: null,
};
const captured: MoneyView = {
  ...held,
  stage: "captured",
  amounts: { amount: "1200.00", fee: "60.00", payout: "1140.00", currency: "USD" },
  publishedAt: at("2026-10-11T09:30:00Z"),
  capture: { status: "completed", reference: "CAP-1", at: at("2026-10-11T09:40:05Z") },
  payout: { status: "sending", canSendAgain: false },
};

describe("AH-FR-06 to AH-FR-08 one row of the payment history, from the money path's own view", () => {
  test("a held post: its amount in whole minor units, its hold and its deadline, and nothing that has not happened yet", () => {
    expect(paymentRow(post, held)).toEqual({
      ...post,
      amountMinor: 120_000,
      currency: "USD",
      stage: "held",
      holdReference: "HOLD-1",
      heldAt: "2026-10-10T09:05:10.000Z",
      deadline: "2026-10-24T22:59:00.000Z",
    });
  });

  test("once the hold is taken: the fee and what the creator receives as the money path worked them out, the payout, and when it was published", () => {
    expect(paymentRow(post, captured)).toMatchObject({ stage: "captured", amountMinor: 120_000, feeMinor: 6_000, receivedMinor: 114_000, publishedAt: "2026-10-11T09:30:00.000Z", payout: { state: "sending" } });
    expect(paymentRow(post, captured)).not.toHaveProperty("paidAt");
  });

  test.each([
    ["sending", "sending"],
    ["not_sent", "delayed"],
    ["unclaimed", "unclaimed"],
    ["failed", "failed"],
    ["cancelling", "cancelling"],
  ] as const)("a payout the money path has as %s reads as %s, as on the creator's post", (status, state) => {
    expect(paymentRow(post, { ...captured, payout: { status, canSendAgain: false } })!.payout).toEqual({ state });
  });

  test("paid: the payout's PayPal reference, and when it was paid", () => {
    const paid: MoneyView = { ...captured, stage: "paid", payout: { status: "paid", reference: "PAYOUT-1", at: at("2026-10-12T08:00:00Z"), canSendAgain: false } };

    expect(paymentRow(post, paid)).toMatchObject({ stage: "paid", payout: { state: "paid", reference: "PAYOUT-1", at: "2026-10-12T08:00:00.000Z" }, paidAt: "2026-10-12T08:00:00.000Z" });
  });

  test("released, and approved but not paid: the row stays, with what was held", () => {
    const released: MoneyView = { ...held, stage: "released", release: { reason: "deadline", at: at("2026-10-24T23:00:00Z") } };
    const unpaid: MoneyView = { ...held, stage: "approved_not_paid", publishedAt: at("2026-10-11T09:30:00Z") };

    expect(paymentRow(post, released)).toMatchObject({ stage: "released", amountMinor: 120_000, holdReference: "HOLD-1" });
    expect(paymentRow(post, unpaid)).toMatchObject({ stage: "approved_not_paid", amountMinor: 120_000 });
    expect(paymentRow(post, released)).not.toHaveProperty("feeMinor");
  });

  test("AH-FR-05 a post that never had a hold has no row", () => {
    expect(paymentRow(post, { ...held, stage: "not_held", hold: { state: "not_started" } })).toBeUndefined();
    expect(paymentRow(post, { ...held, stage: "not_held", hold: { state: "declined", reason: "timed_out" } })).toBeUndefined();
    expect(paymentRow(post, { ...held, stage: "closed_not_held", hold: { state: "not_held", because: "never_held" } })).toBeUndefined();
  });

  test("AH-BR-07 amounts are whole minor units, exactly: no fraction is ever worked out", () => {
    const odd: MoneyView = { ...captured, amounts: { amount: "20.07", fee: "1.00", payout: "19.07", currency: "USD" } };

    expect(paymentRow(post, odd)).toMatchObject({ amountMinor: 2_007, feeMinor: 100, receivedMinor: 1_907 });
    expect(paymentRow(post, { ...held, amounts: { ...held.amounts, amount: "10000.00" } })!.amountMinor).toBe(1_000_000);
  });

  test("AH-FR-09 whether the first draft check passed is there once a check has finished, and absent before", () => {
    expect(paymentRow(post, held)).not.toHaveProperty("firstCheckPassed");
    expect(paymentRow(post, held, true)!.firstCheckPassed).toBe(true);
    expect(paymentRow(post, held, false)!.firstCheckPassed).toBe(false);
    expect(paymentRow(post, held, null)).not.toHaveProperty("firstCheckPassed");
  });
});
