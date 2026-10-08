"use client";

import { useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { BrandDeal } from "@/lib/brand-deal/types";

/**
 * Loads the deal as the brand sees it. `setDeal` takes what a saved change returned.
 *
 * @param dealId - the deal
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-03, CH-FR-20
 */
export function useBrandDeal(dealId: string) {
  const [deal, setDeal] = useState<BrandDeal | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    api.getBrandDeal(dealId).then((r) => {
      if (!live) return;
      if (r.ok) setDeal(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [dealId]);

  return { deal, error, setDeal };
}
