import { describe, expect, test } from "bun:test";
import { ApiError } from "@paypal/paypal-server-sdk";
import { dollars, holdStatus, orderOutcome, refusedClearly } from "./answers";
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
