"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { z } from "zod";
import { api } from "@/lib/api";
import type { dealsSchema } from "@/lib/api/schemas";

export type DealsLoad =
  | { status: "loading" }
  | { status: "ready"; deals: z.infer<typeof dealsSchema> }
  | { status: "error" };

const DealsContext = createContext<DealsLoad | null>(null);
const RefreshContext = createContext<() => void>(() => {});

/**
 * Loads the creator's deals once and shares them with the rail, the phone
 * sheet, the deal redirect and the deliverable switcher (DC-FR-31, DC-FR-33,
 * DC-FR-37). Reloaded when a page moves a deal to another step (BC-FR-17,
 * IN-FR-02).
 */
export function DealsProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState<DealsLoad>({ status: "loading" });
  useEffect(() => {
    let current = true;
    api.getDeals().then((r) => current && setLoad(r.ok ? { status: "ready", deals: r.data } : { status: "error" }));
    return () => {
      current = false;
    };
  }, []);
  // A failed reload keeps the list already shown rather than blanking the rail.
  const refresh = useCallback(() => {
    api.getDeals().then((r) => r.ok && setLoad({ status: "ready", deals: r.data }));
  }, []);
  return (
    <RefreshContext.Provider value={refresh}>
      <DealsContext.Provider value={load}>{children}</DealsContext.Provider>
    </RefreshContext.Provider>
  );
}

/** Reloads the deal list; does nothing without a DealsProvider (pages rendered without the shell). */
export function useRefreshDeals(): () => void {
  return useContext(RefreshContext);
}

/** The creator's deals if a DealsProvider is above, else null (pages rendered without the shell). */
export function useOptionalDeals(): DealsLoad | null {
  return useContext(DealsContext);
}

/** The creator's deals, from the nearest DealsProvider. */
export function useDeals(): DealsLoad {
  const load = useContext(DealsContext);
  if (!load) throw new Error("useDeals needs a DealsProvider (the app shell provides one)");
  return load;
}
