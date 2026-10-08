"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PayPalApprovalProvider } from "@/components/brand-deal/paypal-approval";
import { worker } from "@/mocks/browser";
import { resetSaved } from "@/mocks/browser-persist";
import { DemoBuildProvider } from "./demo-build";
import { DemoPayPal } from "./demo-paypal";

/**
 * Browser-only: starts the MSW worker and renders children once it is ready,
 * so no early request goes unmocked. Holds are approved with the demo PayPal
 * (CH-FR-17), which ships only with the mocks. Loaded by `MockProvider` with
 * `ssr: false`, because MSW's browser entry cannot load on the server.
 *
 * @param children - the app
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
// One start per page load: React runs effects twice in development, and MSW
// throws "cannot configure an already enabled network" if started again.
let started: Promise<unknown> | null = null;

export default function MockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    started ??= worker.start({ onUnhandledFrame: "bypass" });
    started.then(() => current && setReady(true));
    return () => {
      current = false;
    };
  }, []);

  return ready ? (
    <DemoBuildProvider
      reset={() => {
        resetSaved();
        // A full load, so every page fetches the seed again.
        window.location.replace(new URL("/deals", window.location.href));
      }}
    >
      <PayPalApprovalProvider approval={DemoPayPal}>{children}</PayPalApprovalProvider>
    </DemoBuildProvider>
  ) : null;
}
