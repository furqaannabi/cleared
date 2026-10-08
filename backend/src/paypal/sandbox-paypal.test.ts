/**
 * The calls the real port makes with plain HTTP: payouts and webhook verification. PayPal is replaced by a
 * stand-in `fetch`, so these run on every push. The same calls against the real sandbox are in sandbox/.
 */
import { describe, expect, test } from "bun:test";
import { createSandboxPayPal, PAYPAL_API } from "./sandbox-paypal";

interface SentRequest {
  method: string;
  path: string;
  headers: Headers;
  body: string;
}

type Answer = { status: number; json?: unknown } | "network_error";

/** A PayPal that answers each call with whatever the test says, and remembers what it was sent. */
function standIn(answer: (request: SentRequest) => Answer | undefined) {
  const requests: SentRequest[] = [];
  const logged: unknown[] = [];
  const fetchStandIn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const request: SentRequest = {
      method: init?.method ?? "GET",
      path: url.origin === PAYPAL_API ? url.pathname : String(input),
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : "",
    };
    requests.push(request);
    if (request.path === "/v1/oauth2/token") {
      return Response.json({ access_token: "token-1", expires_in: 32_400 });
    }
    const given = answer(request) ?? { status: 404, json: {} };
    if (given === "network_error") throw new TypeError("fetch failed");
    return new Response(given.json === undefined ? null : JSON.stringify(given.json), { status: given.status });
  };
  const paypal = createSandboxPayPal({
    clientId: "client-id",
    clientSecret: "client-secret",
    webhookId: "WEBHOOK-1",
    fetch: fetchStandIn,
    log: (...parts) => logged.push(parts),
  });
  /** The calls made, leaving out the log-in. */
  const calls = () => requests.filter((request) => request.path !== "/v1/oauth2/token");
  return { paypal, requests, calls, logged };
}

const payout = { requestId: "req_payout", email: "creator@example.com", amountCents: 114_000 };

describe("MP-FR-28 sending a payout", () => {
  test("it sends the amount as a decimal string to the creator's email, under the request id", async () => {
    const { paypal, calls } = standIn(() => ({ status: 201, json: { batch_header: { payout_batch_id: "BATCH-1" } } }));

    expect(await paypal.sendPayout(payout)).toEqual({ outcome: "accepted", payoutReference: "BATCH-1" });

    const [sent] = calls();
    expect(sent).toMatchObject({ method: "POST", path: "/v1/payments/payouts" });
    expect(sent!.headers.get("authorization")).toBe("Bearer token-1");
    expect(sent!.headers.get("paypal-request-id")).toBe("req_payout");
    expect(JSON.parse(sent!.body)).toMatchObject({
      sender_batch_header: { sender_batch_id: "req_payout" },
      items: [{ recipient_type: "EMAIL", receiver: "creator@example.com", amount: { value: "1140.00", currency: "USD" } }],
    });
  });

  test.each<[string, Answer]>([
    ["a server error", { status: 500, json: { debug_id: "DEBUG-1" } }],
    ["no answer", "network_error"],
    ["an answer with no reference in it", { status: 201, json: {} }],
  ])("%s is unknown, never a refusal (MP-BR-06)", async (_, answer) => {
    const { paypal } = standIn(() => answer);

    expect(await paypal.sendPayout(payout)).toEqual({ outcome: "unknown" });
  });

  test("a failure is logged with PayPal's ids, and never the creator's email (MP-BR-11)", async () => {
    const { paypal, logged } = standIn(() => ({
      status: 500,
      json: { debug_id: "DEBUG-1", message: "could not pay creator@example.com" },
    }));

    await paypal.sendPayout(payout);

    expect(JSON.stringify(logged)).toContain("DEBUG-1");
    expect(JSON.stringify(logged)).not.toContain("creator@example.com");
    expect(JSON.stringify(logged)).not.toContain("client-secret");
  });
});

describe("MP-FR-29 reading a payout", () => {
  test("it reads how the payout stands", async () => {
    const { paypal, calls } = standIn(() => ({
      status: 200,
      json: { batch_header: { batch_status: "SUCCESS" }, items: [{ payout_item_id: "ITEM-1", transaction_status: "UNCLAIMED" }] },
    }));

    expect(await paypal.readPayout("BATCH-1")).toEqual({ outcome: "unclaimed" });
    expect(calls()[0]).toMatchObject({ method: "GET", path: "/v1/payments/payouts/BATCH-1" });
  });

  test("no answer is unknown", async () => {
    const { paypal } = standIn(() => "network_error");

    expect(await paypal.readPayout("BATCH-1")).toEqual({ outcome: "unknown" });
  });
});

describe("MP-FR-30 cancelling an unclaimed payout", () => {
  const batch = (transaction_status: string) => ({
    status: 200,
    json: { batch_header: { batch_status: "SUCCESS" }, items: [{ payout_item_id: "ITEM-1", transaction_status }] },
  });

  test("an unclaimed payout is cancelled", async () => {
    const { paypal, calls } = standIn((request) =>
      request.method === "GET" ? batch("UNCLAIMED") : { status: 200, json: { transaction_status: "RETURNED" } },
    );

    expect(await paypal.cancelPayout("BATCH-1")).toEqual({ outcome: "cancelled" });
    expect(calls().map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /v1/payments/payouts/BATCH-1",
      "POST /v1/payments/payouts-item/ITEM-1/cancel",
    ]);
  });

  test.each(["SUCCESS", "PENDING", "FAILED"])("a %s payout is not cancellable, and PayPal is not asked to", async (status) => {
    const { paypal, calls } = standIn(() => batch(status));

    expect(await paypal.cancelPayout("BATCH-1")).toEqual({ outcome: "not_cancellable" });
    expect(calls()).toHaveLength(1);
  });

  test("PayPal refusing the cancellation is not cancellable; no answer is unknown", async () => {
    const refused = standIn((request) => (request.method === "GET" ? batch("UNCLAIMED") : { status: 422, json: {} }));
    expect(await refused.paypal.cancelPayout("BATCH-1")).toEqual({ outcome: "not_cancellable" });

    const silent = standIn((request) => (request.method === "GET" ? batch("UNCLAIMED") : "network_error"));
    expect(await silent.paypal.cancelPayout("BATCH-1")).toEqual({ outcome: "unknown" });

    const unread = standIn(() => "network_error");
    expect(await unread.paypal.cancelPayout("BATCH-1")).toEqual({ outcome: "unknown" });
  });
});

describe("MP-FR-35 verifying a webhook", () => {
  const headers = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "TRANSMISSION-1",
    "paypal-transmission-sig": "SIGNATURE-1",
    "paypal-transmission-time": "2026-10-17T09:40:05Z",
  };
  // Spacing and key order PayPal signed. Re-writing the JSON would break the signature.
  const body = '{"id":"WH-1",  "event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"amount":{"value":"1200.00"}}}';

  test("true when PayPal confirms it sent the event, which is passed on exactly as received", async () => {
    const { paypal, calls } = standIn(() => ({ status: 200, json: { verification_status: "SUCCESS" } }));

    expect(await paypal.verifyWebhook({ headers, body })).toBe(true);

    const [sent] = calls();
    expect(sent).toMatchObject({ method: "POST", path: "/v1/notifications/verify-webhook-signature" });
    expect(sent!.body).toContain(`"webhook_event":${body}`);
    expect(JSON.parse(sent!.body)).toMatchObject({
      webhook_id: "WEBHOOK-1",
      transmission_id: "TRANSMISSION-1",
      transmission_sig: "SIGNATURE-1",
      transmission_time: "2026-10-17T09:40:05Z",
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    });
  });

  test("header names are matched whatever their capitals", async () => {
    const { paypal } = standIn(() => ({ status: 200, json: { verification_status: "SUCCESS" } }));
    const capitals = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toUpperCase(), value]));

    expect(await paypal.verifyWebhook({ headers: capitals, body })).toBe(true);
  });

  test.each<[string, Answer]>([
    ["PayPal says it did not send it", { status: 200, json: { verification_status: "FAILURE" } }],
    ["PayPal answers with an error", { status: 500, json: {} }],
    ["PayPal does not answer", "network_error"],
  ])("false when %s (MP-BR-12)", async (_, answer) => {
    const { paypal } = standIn(() => answer);

    expect(await paypal.verifyWebhook({ headers, body })).toBe(false);
  });

  test("false, without asking PayPal, when a signature header is missing or the body is not JSON", async () => {
    const { paypal, requests } = standIn(() => ({ status: 200, json: { verification_status: "SUCCESS" } }));
    const { "paypal-transmission-sig": _removed, ...unsigned } = headers;

    expect(await paypal.verifyWebhook({ headers: unsigned, body })).toBe(false);
    expect(await paypal.verifyWebhook({ headers, body: "not json" })).toBe(false);
    expect(await paypal.verifyWebhook({ headers, body: '"a string"' })).toBe(false);
    expect(requests).toHaveLength(0);
  });

  test("false, without asking PayPal, when no webhook id is configured", async () => {
    const requests: unknown[] = [];
    const paypal = createSandboxPayPal({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetch: async (input) => {
        requests.push(input);
        return Response.json({ verification_status: "SUCCESS" });
      },
    });

    expect(await paypal.verifyWebhook({ headers, body })).toBe(false);
    expect(requests).toHaveLength(0);
  });
});

describe("MP-BR-10 sandbox only", () => {
  test("every plain-HTTP call goes to the sandbox, and the log-in is made once", async () => {
    const { paypal, requests } = standIn((request) =>
      request.method === "POST"
        ? { status: 201, json: { batch_header: { payout_batch_id: "BATCH-1" } } }
        : { status: 200, json: { batch_header: { batch_status: "PENDING" } } },
    );

    await paypal.sendPayout(payout);
    await paypal.readPayout("BATCH-1");

    // A path is recorded only for the sandbox's address; anything else would be recorded as a full URL.
    expect(requests.map((request) => request.path)).toEqual([
      "/v1/oauth2/token",
      "/v1/payments/payouts",
      "/v1/payments/payouts/BATCH-1",
    ]);
  });

  test("a rejected log-in makes the call unknown", async () => {
    const paypal = createSandboxPayPal({
      clientId: "client-id",
      clientSecret: "wrong",
      fetch: async () => Response.json({ error: "invalid_client" }, { status: 401 }),
    });

    expect(await paypal.sendPayout(payout)).toEqual({ outcome: "unknown" });
  });
});
