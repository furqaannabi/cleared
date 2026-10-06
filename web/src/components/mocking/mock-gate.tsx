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
export default function MockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    worker.start({ onUnhandledFrame: "bypass" }).then(() => setReady(true));
  }, []);

  return ready ? children : null;
}
