"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PaymentRow } from "@/lib/home/payment-row";

export type PaymentsLoad = { status: "off" } | { status: "loading" } | { status: "ready"; rows: PaymentRow[] } | { status: "error" };

/**
 * The creator's payment rows from `GET /me/payments`, loaded only when the
 * payments flag is on; Try again loads them again.
 *
 * @param enabled - the payments flag
 * @see docs/specs/creator-home-frd.md HM-FR-04, HM-FR-20
 */
export function usePayments(enabled: boolean): { load: PaymentsLoad; retry: () => void } {
  const [load, setLoad] = useState<PaymentsLoad>(enabled ? { status: "loading" } : { status: "off" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    api.getPayments().then((r) => current && setLoad(r.ok ? { status: "ready", rows: r.data } : { status: "error" }));
    return () => {
      current = false;
    };
  }, [enabled, attempt]);
  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { load, retry };
}
