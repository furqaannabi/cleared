/**
 * The real PayPal port, against the sandbox (docs/decisions/2026-10-08-paypal-client-sdk-behind-port.md).
 *
 * Orders and holds go through PayPal's server SDK. Payouts and webhook verification are not in that SDK,
 * so they are plain HTTP to the same sandbox.
 */
import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import {
  captureOutcome,
  describeFailure,
  dollars,
  holdStatus,
  orderOutcome,
  payoutStatus,
  refusedClearly,
  renewOutcome,
  type PayoutAnswer,
} from "./answers";
import type { HoldStatus, PayPalPort } from "./port";

/**
 * PayPal's sandbox, and the only PayPal this service can talk to. It is fixed here and is not read from
 * configuration, so no setting can point the service at live PayPal (MP-BR-10).
 */
export const PAYPAL_API = "https://api-m.sandbox.paypal.com";

const TIMEOUT_MS = 20_000;

export interface SandboxPayPalConfig {
  clientId: string;
  clientSecret: string;
  /** The id PayPal gave the registered webhook. Without it no event can be verified, so none is accepted. */
  webhookId?: string;
  /** Where PayPal sends the brand after approving or closing, when the approval is not in a pop-up. */
  returnUrl?: string;
  cancelUrl?: string;
  /** Told about each failed call: its status and PayPal's ids only. */
  log?: (message: string, details: Record<string, unknown>) => void;
  /** The `fetch` used for the plain-HTTP calls. Tests pass a stand-in. */
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/** Reads the sandbox credentials from the environment. They are never logged. */
export function sandboxPayPalFromEnv(): PayPalPort {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET. See backend/.env.example.");
  }
  return createSandboxPayPal({ clientId, clientSecret, webhookId: process.env.PAYPAL_WEBHOOK_ID || undefined });
}

/** The headers PayPal signs a webhook with. All five are needed to verify one. */
const SIGNATURE_HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

export function createSandboxPayPal(config: SandboxPayPalConfig): PayPalPort {
  const client = new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: { oAuthClientId: config.clientId, oAuthClientSecret: config.clientSecret },
    timeout: TIMEOUT_MS,
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);
  const failed = (call: string, error: unknown) => config.log?.(`PayPal ${call} failed`, describeFailure(error));

  // Plain HTTP, for what the SDK does not cover.

  const send = config.fetch ?? fetch;
  let login: { token: string; expiresAt: number } | undefined;

  async function accessToken(): Promise<string | undefined> {
    if (login && login.expiresAt > Date.now()) return login.token;
    const response = await send(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const answer = (await response.json().catch(() => undefined)) as { access_token?: unknown; expires_in?: unknown } | undefined;
    if (!response.ok || typeof answer?.access_token !== "string") return undefined;
    const lifetimeSeconds = typeof answer.expires_in === "number" ? answer.expires_in : 0;
    // Renewed a minute early, so a token never expires mid-call.
    login = { token: answer.access_token, expiresAt: Date.now() + (lifetimeSeconds - 60) * 1000 };
    return login.token;
  }

  /** One call to PayPal. It never throws: `status` 0 means there was no answer. */
  async function http(
    call: string,
    method: "GET" | "POST",
    path: string,
    options: { body?: string; requestId?: string } = {},
  ): Promise<{ status: number; json: unknown }> {
    let status = 0;
    let json: unknown;
    try {
      const token = await accessToken();
      if (token) {
        const response = await send(`${PAYPAL_API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.requestId ? { "PayPal-Request-Id": options.requestId } : {}),
          },
          body: options.body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        status = response.status;
        json = await response.json().catch(() => undefined);
        // A rejected token is dropped, so the next call logs in again.
        if (status === 401) login = undefined;
      }
    } catch {
      status = 0;
    }
    if (status < 200 || status >= 300) {
      const debugId = (json as { debug_id?: unknown } | undefined)?.debug_id;
      // The status and PayPal's own id only. The answer's text can repeat what was sent, such as an email.
      config.log?.(`PayPal ${call} failed`, { status, debugId: typeof debugId === "string" ? debugId : undefined });
    }
    return { status, json };
  }

  const ok = (status: number) => status >= 200 && status < 300;

  async function readHold(reference: string): Promise<HoldStatus> {
    try {
      const { result } = await payments.getAuthorizedPayment({ authorizationId: reference });
      return holdStatus(result);
    } catch (error) {
      failed("readHold", error);
      return "unknown";
    }
  }

  return {
    async createOrder({ requestId, deliverableId, amountCents }) {
      const value = dollars(amountCents);
      try {
        const { result } = await orders.createOrder({
          paypalRequestId: requestId,
          prefer: "return=representation",
          body: {
            intent: CheckoutPaymentIntent.Authorize,
            purchaseUnits: [
              { referenceId: deliverableId, customId: deliverableId, amount: { currencyCode: "USD", value } },
            ],
            paymentSource: {
              paypal: {
                experienceContext: {
                  shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
                  returnUrl: config.returnUrl,
                  cancelUrl: config.cancelUrl,
                },
              },
            },
          },
        });
        const approveUrl = result.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
        if (!result.id || !approveUrl) return { outcome: "unknown" };
        return { outcome: "created", orderId: result.id, approveUrl };
      } catch (error) {
        failed("createOrder", error);
        return { outcome: "unknown" };
      }
    },

    async authorizeOrder({ requestId, orderId }) {
      try {
        const { result } = await orders.authorizeOrder({
          id: orderId,
          paypalRequestId: requestId,
          prefer: "return=representation",
        });
        const outcome = orderOutcome(result);
        // PayPal answered without a hold on the order: not a refusal, so it is checked, not retried as new.
        return outcome.outcome === "not_held" ? { outcome: "unknown" } : outcome;
      } catch (error) {
        failed("authorizeOrder", error);
        return refusedClearly(error) ? { outcome: "declined" } : { outcome: "unknown" };
      }
    },

    async readOrder(orderId) {
      try {
        const { result } = await orders.getOrder({ id: orderId });
        return orderOutcome(result);
      } catch (error) {
        failed("readOrder", error);
        return { outcome: "unknown" };
      }
    },

    readHold,

    async renewHold({ requestId, reference, amountCents }) {
      const value = dollars(amountCents);
      try {
        const { result } = await payments.reauthorizePayment({
          authorizationId: reference,
          paypalRequestId: requestId,
          prefer: "return=representation",
          body: { amount: { currencyCode: "USD", value } },
        });
        return renewOutcome(result);
      } catch (error) {
        failed("renewHold", error);
        return refusedClearly(error) ? { outcome: "refused" } : { outcome: "unknown" };
      }
    },

    async captureHold({ requestId, reference, amountCents }) {
      const value = dollars(amountCents);
      try {
        const { result } = await payments.captureAuthorizedPayment({
          authorizationId: reference,
          paypalRequestId: requestId,
          prefer: "return=representation",
          body: { amount: { currencyCode: "USD", value }, finalCapture: true },
        });
        return captureOutcome(result);
      } catch (error) {
        failed("captureHold", error);
        return refusedClearly(error) ? { outcome: "refused" } : { outcome: "unknown" };
      }
    },

    async cancelHold(reference) {
      try {
        const { result } = await payments.voidPayment({ authorizationId: reference, prefer: "return=representation" });
        return !result || result.status === "VOIDED" ? "cancelled" : "unknown";
      } catch (error) {
        failed("cancelHold", error);
        if (!refusedClearly(error)) return "unknown";
        // PayPal will not cancel it. What the caller records depends on why, so read what state it is in.
        const status = await readHold(reference);
        if (status === "ended") return "already_ended";
        return status === "unknown" ? "unknown" : "failed";
      }
    },

    async sendPayout({ requestId, email, amountCents }) {
      const body = JSON.stringify({
        sender_batch_header: { sender_batch_id: requestId },
        items: [
          {
            recipient_type: "EMAIL",
            receiver: email,
            amount: { value: dollars(amountCents), currency: "USD" },
            sender_item_id: requestId,
          },
        ],
      });
      const { status, json } = await http("sendPayout", "POST", "/v1/payments/payouts", { body, requestId });
      const payoutReference = (json as { batch_header?: { payout_batch_id?: unknown } } | undefined)?.batch_header
        ?.payout_batch_id;
      // Anything but a clear yes is unknown. A refusal is never assumed here: acting on one sends a second payout.
      if (!ok(status) || typeof payoutReference !== "string") return { outcome: "unknown" };
      return { outcome: "accepted", payoutReference };
    },

    async readPayout(payoutReference) {
      const { status, json } = await http("readPayout", "GET", `/v1/payments/payouts/${encodeURIComponent(payoutReference)}`);
      return ok(status) ? payoutStatus((json ?? {}) as PayoutAnswer) : { outcome: "unknown" };
    },

    async cancelPayout(payoutReference) {
      const read = await http("readPayout", "GET", `/v1/payments/payouts/${encodeURIComponent(payoutReference)}`);
      if (!ok(read.status)) return { outcome: "unknown" };
      const batch = (read.json ?? {}) as PayoutAnswer;
      const itemId = batch.items?.[0]?.payout_item_id;
      if (payoutStatus(batch).outcome !== "unclaimed" || !itemId) return { outcome: "not_cancellable" };
      const { status } = await http("cancelPayout", "POST", `/v1/payments/payouts-item/${encodeURIComponent(itemId)}/cancel`);
      if (ok(status)) return { outcome: "cancelled" };
      return { outcome: status === 400 || status === 422 ? "not_cancellable" : "unknown" };
    },

    async verifyWebhook({ headers, body }) {
      if (!config.webhookId) return false;
      const received = new Headers(headers);
      const signature: Record<string, string> = {};
      for (const [field, header] of Object.entries(SIGNATURE_HEADERS)) {
        const value = received.get(header);
        if (!value) return false;
        signature[field] = value;
      }
      try {
        const event: unknown = JSON.parse(body);
        if (typeof event !== "object" || event === null) return false;
      } catch {
        return false;
      }
      // The event goes in exactly as received. PayPal signed those bytes, and re-writing the JSON breaks the check.
      const fields = JSON.stringify({ ...signature, webhook_id: config.webhookId });
      const request = `${fields.slice(0, -1)},"webhook_event":${body}}`;
      const { status, json } = await http("verifyWebhook", "POST", "/v1/notifications/verify-webhook-signature", {
        body: request,
      });
      return ok(status) && (json as { verification_status?: unknown } | undefined)?.verification_status === "SUCCESS";
    },
  };
}
