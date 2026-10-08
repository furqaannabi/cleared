/**
 * The real PayPal port, against the sandbox (docs/decisions/2026-10-08-paypal-client-sdk-behind-port.md).
 *
 * Built so far: the calls that make and read a hold. Renewing, capturing, cancelling, payouts and webhook
 * verification follow, so this returns part of the port for now.
 */
import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import { describeFailure, dollars, holdStatus, orderOutcome, refusedClearly } from "./answers";
import type { PayPalPort } from "./port";

/**
 * PayPal's sandbox, and the only PayPal this service can talk to. It is fixed here and is not read from
 * configuration, so no setting can point the service at live PayPal (MP-BR-10).
 */
export const PAYPAL_API = "https://api-m.sandbox.paypal.com";

export interface SandboxPayPalConfig {
  clientId: string;
  clientSecret: string;
  /** Where PayPal sends the brand after approving or closing, when the approval is not in a pop-up. */
  returnUrl?: string;
  cancelUrl?: string;
  /** Told about each failed call: its status and PayPal's ids only. */
  log?: (message: string, details: Record<string, unknown>) => void;
}

type HoldCalls = Pick<PayPalPort, "createOrder" | "authorizeOrder" | "readOrder" | "readHold">;

/** Reads the sandbox credentials from the environment. They are never logged. */
export function sandboxPayPalFromEnv(): HoldCalls {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET. See backend/.env.example.");
  }
  return createSandboxPayPal({ clientId, clientSecret });
}

export function createSandboxPayPal(config: SandboxPayPalConfig): HoldCalls {
  const client = new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: { oAuthClientId: config.clientId, oAuthClientSecret: config.clientSecret },
    timeout: 20_000,
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);
  const failed = (call: string, error: unknown) => config.log?.(`PayPal ${call} failed`, describeFailure(error));

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

    async readHold(reference) {
      try {
        const { result } = await payments.getAuthorizedPayment({ authorizationId: reference });
        return holdStatus(result);
      } catch (error) {
        failed("readHold", error);
        return "unknown";
      }
    },
  };
}
