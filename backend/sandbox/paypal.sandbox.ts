/**
 * The sandbox suite: the real PayPal port against PayPal's sandbox
 * (docs/decisions/2026-10-08-backend-test-tooling.md). Run by hand with `pnpm test:sandbox`, and before
 * release. It is not part of `pnpm test`: it needs the sandbox credentials in .env and a network.
 *
 * Only what needs no person is here. Anything after the brand's approval needs someone to approve in a
 * browser, so those steps are driven by `pnpm sandbox:hold`.
 */
import { describe, expect, test } from "bun:test";
import { sandboxPayPalFromEnv } from "../src/paypal/sandbox-paypal";

const paypal = sandboxPayPalFromEnv();
const newRequestId = () => crypto.randomUUID();

describe("the PayPal sandbox: starting a hold", () => {
  test("an order is created with a link for the brand to approve it", async () => {
    const order = await paypal.createOrder({ requestId: newRequestId(), deliverableId: "sandbox-suite", amountCents: 2_000 });

    expect(order).toEqual({ outcome: "created", orderId: expect.any(String), approveUrl: expect.any(String) });
    if (order.outcome !== "created") return;
    expect(new URL(order.approveUrl).hostname).toBe("www.sandbox.paypal.com");
  });

  test("the same request id sent twice creates one order (MP-BR-06)", async () => {
    const input = { requestId: newRequestId(), deliverableId: "sandbox-suite", amountCents: 2_000 };

    const first = await paypal.createOrder(input);
    const second = await paypal.createOrder(input);

    expect(first.outcome).toBe("created");
    expect(second).toMatchObject({ outcome: "created", orderId: first.outcome === "created" ? first.orderId : "" });
  });

  test("an order nobody has approved reads as not held, and cannot be held", async () => {
    const order = await paypal.createOrder({ requestId: newRequestId(), deliverableId: "sandbox-suite", amountCents: 2_000 });
    if (order.outcome !== "created") throw new Error("the order was not created");

    expect(await paypal.readOrder(order.orderId)).toEqual({ outcome: "not_held" });
    expect(await paypal.authorizeOrder({ requestId: newRequestId(), orderId: order.orderId })).toEqual({
      outcome: "declined",
    });
  });

  test("an order or a hold PayPal has never heard of is unknown, not an error", async () => {
    expect(await paypal.readOrder("NO-SUCH-ORDER")).toEqual({ outcome: "unknown" });
    expect(await paypal.readHold("NO-SUCH-HOLD")).toBe("unknown");
  });
});
