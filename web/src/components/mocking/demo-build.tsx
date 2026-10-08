"use client";

import { createContext, useContext, type ReactNode } from "react";

/** What a mock build offers: a way back to the seeded demo data. */
export interface DemoBuild {
  reset: () => void;
}

const DemoBuildContext = createContext<DemoBuild | null>(null);

/**
 * Marks a mock build, so demo-only conveniences (opening the brand's link in
 * this browser, resetting the demo data) can show. Provided only by the mock
 * gate, which never ships in a production build.
 *
 * @param reset - restores the seeded demo data
 * @param children - the app
 * @see docs/specs/confirm-and-hold-frd.md "Mocks", docs/decisions/2026-10-08-mock-data-kept-in-the-browser.md
 */
export function DemoBuildProvider({ reset = () => {}, children }: { reset?: () => void; children: ReactNode }) {
  return <DemoBuildContext.Provider value={{ reset }}>{children}</DemoBuildContext.Provider>;
}

/** The mock build's conveniences, or null outside one. */
export const useDemoBuild = () => useContext(DemoBuildContext);
