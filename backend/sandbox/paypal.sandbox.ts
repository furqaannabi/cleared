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

describe("the PayPal sandbox: paying out", () => {
  /** Reads a payout until `done` says so, or about two minutes pass. */
  async function waitFor<Result>(read: () => Promise<Result>, done: (result: Result) => boolean): Promise<Result> {
    let result = await read();
    for (let tries = 0; tries < 24 && !done(result); tries++) {
      await Bun.sleep(5_000);
      result = await read();
    }
    return result;
  }

  test(
    "a payout to an email with no PayPal account is sent once, sits unclaimed, and can be cancelled (MP-BR-06, MP-FR-29, MP-FR-30)",
    async () => {
      const requestId = newRequestId();
      // example.com is reserved, so nobody can ever claim it.
      const input = { requestId, email: `cleared-sandbox-${requestId.slice(0, 8)}@example.com`, amountCents: 100 };

      const sent = await paypal.sendPayout(input);
      expect(sent).toEqual({ outcome: "accepted", payoutReference: expect.any(String) });
      if (sent.outcome !== "accepted") return;

      // The same request again finds the first payout and sends nothing new.
      expect(await paypal.sendPayout(input)).toEqual(sent);

      const settled = await waitFor(
        () => paypal.readPayout(sent.payoutReference),
        (status) => status.outcome !== "pending",
      );
      expect(settled).toEqual({ outcome: "unclaimed" });

      // PayPal allows the cancel only once it has finished processing; until then the port says unknown.
      const cancelled = await waitFor(
        () => paypal.cancelPayout(sent.payoutReference),
        (result) => result.outcome !== "unknown",
      );
      expect(cancelled).toEqual({ outcome: "cancelled" });

      const after = await waitFor(
        () => paypal.readPayout(sent.payoutReference),
        (status) => status.outcome !== "unclaimed",
      );
      expect(after).toEqual({ outcome: "returned" });
      expect(await paypal.cancelPayout(sent.payoutReference)).toEqual({ outcome: "not_cancellable" });
    },
    300_000,
  );

  test("a payout PayPal has never heard of is unknown", async () => {
    expect(await paypal.readPayout("NO-SUCH-PAYOUT")).toEqual({ outcome: "unknown" });
  });
});
