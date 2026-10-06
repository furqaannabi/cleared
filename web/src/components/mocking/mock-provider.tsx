"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { shouldEnableMocking } from "@/lib/mocking/should-enable-mocking";

// Read literally so Next inlines both values at build time.
const MOCKING = shouldEnableMocking({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING,
});

// The literal NODE_ENV check lets the bundler drop MSW from production builds.
const MockGate =
  process.env.NODE_ENV === "development" ? dynamic(() => import("./mock-gate"), { ssr: false }) : null;

/**
 * Wraps the app. In development with `NEXT_PUBLIC_API_MOCKING=enabled` it
 * starts the MSW worker before rendering the app; otherwise it renders its
 * children immediately and never loads MSW.
 *
 * @param children - the app
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export function MockProvider({ children }: { children: ReactNode }) {
  if (MOCKING && MockGate) return <MockGate>{children}</MockGate>;
  return children;
}
