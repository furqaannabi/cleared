"use client";

import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer, type DISPATCH_ACTION } from "@paypal/react-paypal-js";
import { useRef, useState, type ReactNode } from "react";

/**
 * PayPal's script, loaded once for the brand's holds as soon as they show, in
 * the sandbox, with the deal's client id and `intent=authorize`, so approving
 * makes a hold, never a payment. A PayPal account or a card only: Pay Later,
 * PayPal Credit and Venmo are turned off.
 *
 * @param clientId - the deal's sandbox client id, from the API
 * @param children - the holds
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17 (1.9)
 * @see docs/decisions/2026-10-13-brand-holds-with-paypal-or-card.md
 */
export function PayPalScript({ clientId, children }: { clientId: string; children: ReactNode }) {
  return (
    <PayPalScriptProvider
      options={{ clientId, intent: "authorize", currency: "USD", components: "buttons", disableFunding: ["paylater", "credit", "venmo"] }}
    >
      {children}
    </PayPalScriptProvider>
  );
}

/**
 * One post's PayPal buttons, the only approve buttons (1.9): one click asks
 * for the order and opens PayPal. "Loading PayPal…" holds their place until
 * the script is ready; if it can't load, or PayPal reports an error, the post
 * says so with "Try again", which loads the script again. An order the API
 * refused is the caller's to explain, never "PayPal didn't load". Nothing here
 * decides a money state.
 *
 * @param createOrder - asks the API for the order; throws when it is refused
 * @param onApproved - the brand approved in PayPal
 * @param onClosed - the brand closed PayPal
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17 (1.9), CH-FR-18
 */
export function PayPalHoldButtons({ createOrder, onApproved, onClosed }: { createOrder: () => Promise<string>; onApproved: () => void; onClosed: () => void }) {
  const [{ options, isPending, isRejected }, dispatch] = usePayPalScriptReducer();
  const [failed, setFailed] = useState(false);
  const refused = useRef(false);

  if (isRejected || failed)
    return (
      <p role="alert" className="text-[13.5px] font-bold text-fail">
        PayPal didn’t load. Nothing was held.{" "}
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            dispatch({ type: "resetOptions" as DISPATCH_ACTION.RESET_OPTIONS, value: options });
          }}
          className="inline-flex min-h-11 items-center text-espresso underline underline-offset-3"
        >
          Try again
        </button>
      </p>
    );
  if (isPending)
    return (
      <p role="status" className="flex min-h-11 items-center text-[13.5px] text-ink-3">
        Loading PayPal…
      </p>
    );
  return (
    <PayPalButtons
      style={{ layout: "vertical", label: "paypal", height: 44 }}
      createOrder={async () => {
        refused.current = false;
        try {
          return await createOrder();
        } catch (e) {
          refused.current = true;
          throw e;
        }
      }}
      onApprove={async () => onApproved()}
      onCancel={() => onClosed()}
      onError={() => {
        if (!refused.current) setFailed(true);
      }}
    />
  );
}
