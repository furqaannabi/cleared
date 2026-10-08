import { describe, expect, test } from "bun:test";
import { FakePayPal } from "./fake-paypal";

/** An order for $1,200.00 that the brand has approved in PayPal. */
async function approvedOrder(paypal: FakePayPal) {
  const order = await paypal.createOrder({ requestId: "req_create", deliverableId: "del_1", amountCents: 120_000 });
  if (order.outcome !== "created") throw new Error("the order was not created");
  paypal.brandApproves(order.orderId);
  return order.orderId;
}

/** A hold for $1,200.00, and its reference. */
async function hold(paypal: FakePayPal) {
  const held = await paypal.authorizeOrder({ requestId: "req_auth", orderId: await approvedOrder(paypal) });
  if (held.outcome !== "held") throw new Error("the order was not held");
  return held.reference;
}

describe("the fake PayPal: holding", () => {
  test("an approved order is held, and reads back as held", async () => {
    const paypal = new FakePayPal();
    const orderId = await approvedOrder(paypal);

    const held = await paypal.authorizeOrder({ requestId: "req_auth", orderId });

    expect(held).toEqual({ outcome: "held", reference: expect.any(String) });
    expect(await paypal.readOrder(orderId)).toEqual(held);
  });

  test("an order the brand has not approved cannot be held", async () => {
    const paypal = new FakePayPal();
    const order = await paypal.createOrder({ requestId: "req_create", deliverableId: "del_1", amountCents: 120_000 });
    if (order.outcome !== "created") throw new Error("the order was not created");

    expect(await paypal.authorizeOrder({ requestId: "req_auth", orderId: order.orderId })).toEqual({ outcome: "declined" });
    expect(await paypal.readOrder(order.orderId)).toEqual({ outcome: "not_held" });
  });

  test("the same request id sent twice creates one order and one hold (MP-BR-06)", async () => {
    const paypal = new FakePayPal();
    const input = { requestId: "req_create", deliverableId: "del_1", amountCents: 120_000 };

    expect(await paypal.createOrder(input)).toEqual(await paypal.createOrder(input));

    const orderId = await approvedOrder(paypal);
    const first = await paypal.authorizeOrder({ requestId: "req_auth", orderId });
    const second = await paypal.authorizeOrder({ requestId: "req_auth", orderId });
    expect(second).toEqual(first);
    expect(paypal.holds()).toHaveLength(1);
  });

  test("it can decline, or answer pending and settle later", async () => {
    const paypal = new FakePayPal();
    const orderId = await approvedOrder(paypal);

    paypal.next("authorizeOrder", "pending");
    expect(await paypal.authorizeOrder({ requestId: "req_auth", orderId })).toEqual({ outcome: "pending" });
    expect(await paypal.readOrder(orderId)).toEqual({ outcome: "pending" });

    paypal.settlePending(orderId, "held");
    expect(await paypal.readOrder(orderId)).toEqual({ outcome: "held", reference: expect.any(String) });

    const other = new FakePayPal();
    const declinedOrder = await approvedOrder(other);
    other.next("authorizeOrder", "declined");
    expect(await other.authorizeOrder({ requestId: "req_auth", orderId: declinedOrder })).toEqual({ outcome: "declined" });
    expect(other.holds()).toHaveLength(0);
  });

  test("it can time out after doing the work: the answer is unknown, but the money is held", async () => {
    const paypal = new FakePayPal();
    const orderId = await approvedOrder(paypal);

    paypal.next("authorizeOrder", "timeout_after");
    expect(await paypal.authorizeOrder({ requestId: "req_auth", orderId })).toEqual({ outcome: "unknown" });

    expect(await paypal.readOrder(orderId)).toEqual({ outcome: "held", reference: expect.any(String) });
  });

  test("it can time out before doing the work: the answer is unknown, and nothing is held", async () => {
    const paypal = new FakePayPal();
    const orderId = await approvedOrder(paypal);

    paypal.next("authorizeOrder", "timeout_before");
    expect(await paypal.authorizeOrder({ requestId: "req_auth", orderId })).toEqual({ outcome: "unknown" });

    expect(paypal.holds()).toHaveLength(0);
    expect(await paypal.readOrder(orderId)).toEqual({ outcome: "not_held" });
    // Sending the same request again is safe, and this time it goes through.
    expect(await paypal.authorizeOrder({ requestId: "req_auth", orderId })).toEqual({
      outcome: "held",
      reference: expect.any(String),
    });
  });
});

describe("the fake PayPal: a hold's life", () => {
  test("a hold is in place until it is cancelled, and cancelling twice says it already ended", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);

    expect(await paypal.readHold(reference)).toBe("in_place");
    expect(await paypal.cancelHold(reference)).toBe("cancelled");
    expect(await paypal.readHold(reference)).toBe("ended");
    expect(await paypal.cancelHold(reference)).toBe("already_ended");
  });

  test("renewing gives a new reference and retires the old one", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);

    const renewed = await paypal.renewHold({ requestId: "req_renew", reference, amountCents: 120_000 });

    expect(renewed).toEqual({ outcome: "renewed", reference: expect.any(String) });
    if (renewed.outcome !== "renewed") return;
    expect(renewed.reference).not.toBe(reference);
    expect(await paypal.readHold(renewed.reference)).toBe("in_place");
    expect(await paypal.readHold(reference)).toBe("ended");
  });

  test("it can refuse to renew, leaving the hold as it was", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);

    paypal.next("renewHold", "refused");

    expect(await paypal.renewHold({ requestId: "req_renew", reference, amountCents: 120_000 })).toEqual({ outcome: "refused" });
    expect(await paypal.readHold(reference)).toBe("in_place");
  });
});

describe("the fake PayPal: capturing", () => {
  test("a capture takes the money once, however often the same request is sent (MP-BR-03, MP-BR-06)", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);
    const input = { requestId: "req_capture", reference, amountCents: 120_000 };

    const first = await paypal.captureHold(input);
    const second = await paypal.captureHold(input);

    expect(first).toEqual({ outcome: "completed", reference: expect.any(String) });
    expect(second).toEqual(first);
    expect(paypal.capturedCents()).toBe(120_000);
    expect(await paypal.readHold(reference)).toBe("captured");
  });

  test("a second capture under a new request id is refused", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);
    await paypal.captureHold({ requestId: "req_capture", reference, amountCents: 120_000 });

    expect(await paypal.captureHold({ requestId: "req_capture_2", reference, amountCents: 120_000 })).toEqual({
      outcome: "refused",
    });
    expect(paypal.capturedCents()).toBe(120_000);
  });

  test("a capture for more than was held is refused", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);

    expect(await paypal.captureHold({ requestId: "req_capture", reference, amountCents: 120_001 })).toEqual({
      outcome: "refused",
    });
    expect(paypal.capturedCents()).toBe(0);
  });

  test("a cancelled hold cannot be captured, and a captured hold cannot be cancelled", async () => {
    const cancelled = new FakePayPal();
    const gone = await hold(cancelled);
    await cancelled.cancelHold(gone);
    expect(await cancelled.captureHold({ requestId: "req_capture", reference: gone, amountCents: 120_000 })).toEqual({
      outcome: "refused",
    });

    const captured = new FakePayPal();
    const taken = await hold(captured);
    await captured.captureHold({ requestId: "req_capture", reference: taken, amountCents: 120_000 });
    expect(await captured.cancelHold(taken)).toBe("failed");
  });

  test("it can refuse a capture once, then let the next try through", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);

    paypal.next("captureHold", "refused");
    expect(await paypal.captureHold({ requestId: "req_capture", reference, amountCents: 120_000 })).toEqual({
      outcome: "refused",
    });
    expect(await paypal.captureHold({ requestId: "req_capture_2", reference, amountCents: 120_000 })).toEqual({
      outcome: "completed",
      reference: expect.any(String),
    });
  });

  test("a capture that timed out after taking the money answers completed when the same request is resent", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);
    const input = { requestId: "req_capture", reference, amountCents: 120_000 };

    paypal.next("captureHold", "timeout_after");
    expect(await paypal.captureHold(input)).toEqual({ outcome: "unknown" });

    expect(await paypal.captureHold(input)).toEqual({ outcome: "completed", reference: expect.any(String) });
    expect(paypal.capturedCents()).toBe(120_000);
  });
});

describe("the fake PayPal: paying out", () => {
  const payout = { requestId: "req_payout", email: "creator@example.com", amountCents: 114_000 };

  test("a payout is accepted and stays pending until PayPal reports a result", async () => {
    const paypal = new FakePayPal();

    const sent = await paypal.sendPayout(payout);

    expect(sent).toEqual({ outcome: "accepted", payoutReference: expect.any(String) });
    if (sent.outcome !== "accepted") return;
    expect(await paypal.readPayout(sent.payoutReference)).toEqual({ outcome: "pending" });

    paypal.payoutEnds(sent.payoutReference, "succeeded");
    expect(await paypal.readPayout(sent.payoutReference)).toEqual({ outcome: "succeeded", reference: expect.any(String) });
    expect(paypal.paidOutCents()).toBe(114_000);
  });

  test("the same request id sent twice pays once (MP-BR-06)", async () => {
    const paypal = new FakePayPal();

    expect(await paypal.sendPayout(payout)).toEqual(await paypal.sendPayout(payout));
    expect(paypal.payouts()).toHaveLength(1);
  });

  test.each(["unclaimed", "failed", "returned", "blocked", "denied"] as const)("it can report a payout as %s", async (result) => {
    const paypal = new FakePayPal();
    const sent = await paypal.sendPayout(payout);
    if (sent.outcome !== "accepted") throw new Error("the payout was not accepted");

    paypal.payoutEnds(sent.payoutReference, result);

    expect(await paypal.readPayout(sent.payoutReference)).toEqual({ outcome: result });
    expect(paypal.paidOutCents()).toBe(0);
  });

  test("it can refuse to send a payout, and the same request sent again later goes through (MP-FR-45)", async () => {
    const paypal = new FakePayPal();

    paypal.next("sendPayout", "refused");
    expect(await paypal.sendPayout(payout)).toEqual({ outcome: "refused" });
    expect(paypal.payouts()).toHaveLength(0);

    expect(await paypal.sendPayout(payout)).toEqual({ outcome: "accepted", payoutReference: expect.any(String) });
    expect(paypal.payouts()).toHaveLength(1);
  });

  test("only an unclaimed payout can be cancelled", async () => {
    const paypal = new FakePayPal();
    const sent = await paypal.sendPayout(payout);
    if (sent.outcome !== "accepted") throw new Error("the payout was not accepted");

    expect(await paypal.cancelPayout(sent.payoutReference)).toEqual({ outcome: "not_cancellable" });

    paypal.payoutEnds(sent.payoutReference, "unclaimed");
    expect(await paypal.cancelPayout(sent.payoutReference)).toEqual({ outcome: "cancelled" });
    // As the sandbox does: a cancelled payout then reads as returned to the sender.
    expect(await paypal.readPayout(sent.payoutReference)).toEqual({ outcome: "returned" });
  });
});

describe("the fake PayPal: webhooks and the call log", () => {
  test("it verifies only the events it sent", async () => {
    const paypal = new FakePayPal();
    const event = paypal.webhook({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" });

    expect(await paypal.verifyWebhook(event)).toBe(true);
    expect(await paypal.verifyWebhook({ headers: event.headers, body: event.body.replace("WH-1", "WH-2") })).toBe(false);
    expect(await paypal.verifyWebhook({ headers: {}, body: event.body })).toBe(false);
  });

  test("it records every call that was made, in order, without the creator's email (MP-BR-11)", async () => {
    const paypal = new FakePayPal();
    const reference = await hold(paypal);
    await paypal.captureHold({ requestId: "req_capture", reference, amountCents: 120_000 });
    await paypal.sendPayout({ requestId: "req_payout", email: "creator@example.com", amountCents: 114_000 });

    expect(paypal.calls.map((call) => call.method)).toEqual(["createOrder", "authorizeOrder", "captureHold", "sendPayout"]);
    expect(JSON.stringify(paypal.calls)).not.toContain("creator@example.com");
  });
});
