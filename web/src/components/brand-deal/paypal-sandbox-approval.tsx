"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { ApprovalProps } from "./paypal-approval";

/**
 * PayPal's own approval step for one hold, in the sandbox: PayPal's button,
 * loaded from PayPal with the deal's client id and `intent=authorize`, so
 * approving makes a hold, never a payment. The order is the one the API
 * created; approving, closing or an error are handed back to the page, which
 * tells the API. Nothing here decides a money state.
 *
 * @param props - the order, the client id and the three outcomes
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17 (1.3), CH-FR-18
 */
export function PayPalSandboxApproval({ clientId, orderId, onApproved, onClosed, onError }: ApprovalProps & { clientId: string }) {
  return (
    <PayPalScriptProvider options={{ clientId, intent: "authorize", currency: "USD", components: "buttons" }}>
      <PayPalButtons
        style={{ layout: "vertical", label: "paypal", height: 44 }}
        createOrder={() => Promise.resolve(orderId)}
        onApprove={async () => onApproved()}
        onCancel={() => onClosed()}
        onError={() => onError()}
      />
    </PayPalScriptProvider>
  );
}
