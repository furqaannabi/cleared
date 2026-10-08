import { describe, expect, test } from "bun:test";
import { ApiError } from "@paypal/paypal-server-sdk";
import {
  captureOutcome,
  dollars,
  holdStatus,
  orderOutcome,
  payoutRefused,
  payoutStatus,
  refusedClearly,
  renewOutcome,
} from "./answers";
import { PAYPAL_API } from "./sandbox-paypal";

describe("MP-BR-05 amounts sent to PayPal", () => {
  test("whole cents become a decimal string with two places", () => {
    expect(dollars(120_000)).toBe("1200.00");
    expect(dollars(3_333)).toBe("33.33");
    expect(dollars(2_005)).toBe("20.05");
    expect(dollars(5)).toBe("0.05");
  });

  test("anything that is not a whole, positive number of cents is an error, not a rounded amount", () => {
    for (const bad of [1200.5, 0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => dollars(bad)).toThrow();
    }
  });
});

describe("MP-FR-06 reading what became of an order", () => {
  const withHold = (status: string) => ({
    id: "ORDER-1",
    status: "COMPLETED",
    purchaseUnits: [{ payments: { authorizations: [{ id: "AUTH-1", status }] } }],
  });

  test("an order nothing was held on", () => {
    expect(orderOutcome({ id: "ORDER-1", status: "CREATED" })).toEqual({ outcome: "not_held" });
    expect(orderOutcome({ id: "ORDER-1", status: "APPROVED", purchaseUnits: [{}] })).toEqual({ outcome: "not_held" });
  });

  test("a hold in place is held, with PayPal's reference for it", () => {
    expect(orderOutcome(withHold("CREATED"))).toEqual({ outcome: "held", reference: "AUTH-1" });
  });

  test("a hold PayPal is still reviewing is pending", () => {
    expect(orderOutcome(withHold("PENDING"))).toEqual({ outcome: "pending" });
  });

  test("a hold PayPal denied is declined", () => {
    expect(orderOutcome(withHold("DENIED"))).toEqual({ outcome: "declined" });
  });

  test("a status this code does not know is unknown, never guessed", () => {
    expect(orderOutcome(withHold("SOMETHING_NEW"))).toEqual({ outcome: "unknown" });
    expect(orderOutcome({ purchaseUnits: [{ payments: { authorizations: [{ status: "CREATED" }] } }] })).toEqual({
      outcome: "unknown",
    });
  });
});

describe("MP-FR-11 reading whether a hold still stands", () => {
  test.each([
    ["CREATED", "in_place"],
    ["CAPTURED", "captured"],
    ["PARTIALLY_CAPTURED", "captured"],
    ["VOIDED", "ended"],
    ["DENIED", "ended"],
    ["PENDING", "unknown"],
    ["SOMETHING_NEW", "unknown"],
    [undefined, "unknown"],
  ] as const)("PayPal's %s is %s", (status, expected) => {
    expect(holdStatus({ status })).toBe(expected);
  });
});

describe("MP-FR-12 reading a renewed hold", () => {
  test("a renewed hold has PayPal's new reference", () => {
    expect(renewOutcome({ id: "AUTH-2", status: "CREATED" })).toEqual({ outcome: "renewed", reference: "AUTH-2" });
  });

  test("a renewal PayPal denied is refused", () => {
    expect(renewOutcome({ id: "AUTH-2", status: "DENIED" })).toEqual({ outcome: "refused" });
  });

  test.each(["PENDING", "SOMETHING_NEW", undefined])("a %s renewal is unknown", (status) => {
    expect(renewOutcome({ id: "AUTH-2", status })).toEqual({ outcome: "unknown" });
  });

  test("a renewal with no reference is unknown", () => {
    expect(renewOutcome({ status: "CREATED" })).toEqual({ outcome: "unknown" });
  });
});

describe("MP-FR-24 reading a capture", () => {
  test("a completed capture has PayPal's reference", () => {
    expect(captureOutcome({ id: "CAPTURE-1", status: "COMPLETED" })).toEqual({ outcome: "completed", reference: "CAPTURE-1" });
  });

  test.each(["DECLINED", "FAILED"])("a %s capture is refused", (status) => {
    expect(captureOutcome({ id: "CAPTURE-1", status })).toEqual({ outcome: "refused" });
  });

  test.each(["PENDING", "SOMETHING_NEW", undefined])("a %s capture is unknown: the money may or may not have moved", (status) => {
    expect(captureOutcome({ id: "CAPTURE-1", status })).toEqual({ outcome: "unknown" });
  });

  test("a completed capture with no reference is unknown", () => {
    expect(captureOutcome({ status: "COMPLETED" })).toEqual({ outcome: "unknown" });
  });
});

describe("MP-FR-29 reading a payout", () => {
  const batch = (transaction_status: string, batch_status = "SUCCESS") => ({
    batch_header: { batch_status },
    items: [{ payout_item_id: "ITEM-1", transaction_status }],
  });

  test("a payout that arrived is succeeded, with PayPal's reference", () => {
    expect(payoutStatus(batch("SUCCESS"))).toEqual({ outcome: "succeeded", reference: "ITEM-1" });
  });

  test.each([
    ["UNCLAIMED", "unclaimed"],
    ["FAILED", "failed"],
    ["RETURNED", "returned"],
    ["REFUNDED", "returned"],
    ["REVERSED", "returned"],
    ["BLOCKED", "blocked"],
    ["DENIED", "denied"],
    ["PENDING", "pending"],
    ["ONHOLD", "pending"],
    ["SOMETHING_NEW", "unknown"],
  ] as const)("PayPal's %s is %s", (status, outcome) => {
    expect(payoutStatus(batch(status))).toEqual({ outcome });
  });

  test("a batch PayPal has not processed yet is pending", () => {
    expect(payoutStatus({ batch_header: { batch_status: "PENDING" } })).toEqual({ outcome: "pending" });
    expect(payoutStatus({ batch_header: { batch_status: "PROCESSING" }, items: [] })).toEqual({ outcome: "pending" });
  });

  test("a batch PayPal denied is denied", () => {
    expect(payoutStatus({ batch_header: { batch_status: "DENIED" } })).toEqual({ outcome: "denied" });
  });

  test("a succeeded payout with no reference, or an answer with nothing in it, is unknown", () => {
    expect(payoutStatus({ batch_header: { batch_status: "SUCCESS" }, items: [{ transaction_status: "SUCCESS" }] })).toEqual({
      outcome: "unknown",
    });
    expect(payoutStatus({})).toEqual({ outcome: "unknown" });
  });
});

describe("MP-FR-45 telling a payout PayPal will not send", () => {
  test.each<[number, unknown]>([
    [403, { name: "PAYOUT_NOT_AVAILABLE" }],
    [422, { name: "INSUFFICIENT_FUNDS" }],
    [400, { name: "USER_BUSINESS_ERROR", details: [{ field: "AMOUNT", issue: "Insufficient funds" }] }],
  ])("a %i that names an error is a refusal", (status, answer) => {
    expect(payoutRefused(status, answer)).toBe(true);
  });

  test("an answer about a payout already sent under that id is not a refusal, with or without a pointer to it", () => {
    const duplicate = (link: unknown[]) => ({ name: "USER_BUSINESS_ERROR", details: [{ field: "SENDER_BATCH_ID", link }] });

    expect(payoutRefused(400, duplicate([{ href: "https://api.sandbox.paypal.com/v1/payments/payouts/BATCH-1" }]))).toBe(false);
    expect(payoutRefused(400, duplicate([]))).toBe(false);
  });

  test.each<[number, unknown]>([
    [400, {}],
    [400, undefined],
    [401, { name: "AUTHENTICATION_FAILURE" }],
    [429, { name: "RATE_LIMIT_REACHED" }],
    [500, { name: "INTERNAL_SERVER_ERROR" }],
    [0, undefined],
    [201, { name: "ODD" }],
  ])("a %i with %p is not a refusal: it is checked, not acted on", (status, answer) => {
    expect(payoutRefused(status, answer)).toBe(false);
  });
});

describe("MP-BR-06 telling a clear refusal from no clear answer", () => {
  const apiError = (statusCode: number) =>
    Object.assign(Object.create(ApiError.prototype), { statusCode, result: {}, headers: {} }) as ApiError;

  test("PayPal saying it will not do it is a clear refusal", () => {
    expect(refusedClearly(apiError(422))).toBe(true);
  });

  test.each([401, 403, 429, 500, 503])("a %i is not: the caller must check before trying anything else", (statusCode) => {
    expect(refusedClearly(apiError(statusCode))).toBe(false);
  });

  test("a request that never got an answer is not", () => {
    expect(refusedClearly(new TypeError("fetch failed"))).toBe(false);
    expect(refusedClearly(new Error("timeout"))).toBe(false);
  });
});

describe("MP-BR-10 sandbox only", () => {
  test("the PayPal address is the sandbox", () => {
    expect(PAYPAL_API).toBe("https://api-m.sandbox.paypal.com");
  });
});
