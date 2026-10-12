"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PaymentRow } from "@/lib/home/payment-row";

export type PaymentsLoad = { status: "loading" } | { status: "ready"; rows: PaymentRow[] } | { status: "error" };

/**
 * The creator's payment rows from `GET /me/payments`; Try again loads them
 * again.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-04
 */
export function usePayments(): { load: PaymentsLoad; retry: () => void } {
  const [load, setLoad] = useState<PaymentsLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    api.getPayments().then((r) => current && setLoad(r.ok ? { status: "ready", rows: r.data } : { status: "error" }));
    return () => {
      current = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { load, retry };
}
