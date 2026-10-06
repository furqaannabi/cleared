"use client";

import { useEffect, useState, type ReactNode } from "react";
import { worker } from "@/mocks/browser";

/**
 * Browser-only: starts the MSW worker and renders children once it is ready,
 * so no early request goes unmocked. Loaded by `MockProvider` with
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

  return ready ? children : null;
}
