import { beforeEach, describe, expect, test } from "bun:test";
import { FakePayPal } from "../test/fake-paypal";
import { createApp } from "./app";
import { prisma } from "./db";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";

beforeEach(async () => {
  await prisma.payPalEvent.deleteMany();
});

function setUp() {
  const paypal = new FakePayPal();
  const logged: unknown[] = [];
  const money = createMoney({ prisma, paypal, posts: recordedPosts(prisma) });
  const app = createApp({ prisma, money, log: (...parts) => logged.push(parts) });
  const post = (delivery: { headers: Record<string, string>; body: string }) =>
    app.request("/webhooks/paypal", { method: "POST", headers: delivery.headers, body: delivery.body });
  return { paypal, app, post, logged };
}

describe("the service", () => {
  test("says whether it is up and can reach Postgres", async () => {
    const { app } = setUp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("MP-FR-35 the webhook route", () => {
  test("an event PayPal sent is acknowledged, and reaches the money module exactly as it was received", async () => {
    const { paypal, post } = setUp();
    // Spacing PayPal signed. The route must not re-write the body before it is verified.
    const signed = paypal.webhook({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.CREATED" });

    const response = await post(signed);

    expect(response.status).toBe(200);
    expect(await prisma.payPalEvent.findMany()).toMatchObject([{ id: "WH-1", outcome: "ignored" }]);
  });

  test("the same event delivered again is acknowledged too, so PayPal stops sending it", async () => {
    const { paypal, post } = setUp();
    const signed = paypal.webhook({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.CREATED" });
    await post(signed);

    expect((await post(signed)).status).toBe(200);
    expect(await prisma.payPalEvent.count()).toBe(1);
  });

  test("an event that fails verification is rejected, and the rejection is logged without its content", async () => {
    const { post, logged } = setUp();

    const response = await post({
      headers: { "paypal-transmission-id": "TRANSMISSION-9", "paypal-transmission-sig": "made-up" },
      body: JSON.stringify({ id: "WH-forged", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { secret: "do-not-log" } }),
    });

    expect(response.status).toBe(400);
    expect(await prisma.payPalEvent.count()).toBe(0);
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).toContain("TRANSMISSION-9");
    expect(JSON.stringify(logged)).not.toContain("do-not-log");
  });

  test("a body far larger than any PayPal event is turned away before it is read", async () => {
    const { post } = setUp();

    const response = await post({ headers: {}, body: "x".repeat(300_000) });

    expect(response.status).toBe(413);
  });

  test("if acting on an event fails, PayPal is told to send it again", async () => {
    const paypal = new FakePayPal();
    const money = createMoney({ prisma, paypal, posts: recordedPosts(prisma) });
    money.webhook = async () => {
      throw new Error("the database went away");
    };
    const app = createApp({ prisma, money, log: () => {} });

    const response = await app.request("/webhooks/paypal", { method: "POST", body: "{}" });

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("database");
  });

  test("without a money module there is no webhook route", async () => {
    const app = createApp({ prisma });

    expect((await app.request("/webhooks/paypal", { method: "POST", body: "{}" })).status).toBe(404);
  });
});
