"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { api } from "@/lib/api";
import type { dealsSchema } from "@/lib/api/schemas";

export type DealsLoad =
  | { status: "loading" }
  | { status: "ready"; deals: z.infer<typeof dealsSchema> }
  | { status: "error" };

/** Loads the creator's deals for the rail and the phone sheet (DC-FR-31). */
export function useDeals(): DealsLoad {
  const [load, setLoad] = useState<DealsLoad>({ status: "loading" });
  useEffect(() => {
    let current = true;
    api.getDeals().then((r) => current && setLoad(r.ok ? { status: "ready", deals: r.data } : { status: "error" }));
    return () => {
      current = false;
    };
  }, []);
  return load;
}
