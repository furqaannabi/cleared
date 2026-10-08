"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { BrandDeliverable } from "@/lib/brand-review/types";

/**
 * Loads one post's review as the brand sees it. `setPost` takes what a saved
 * change returned; `reload` asks the API again (a refused send, RW-FR-20).
 *
 * @param dealId - the deal
 * @param deliverableId - the post
 * @see docs/specs/brand-review-frd.md RW-FR-04, RW-FR-05
 */
export function useBrandDeliverable(dealId: string, deliverableId: string) {
  const [post, setPost] = useState<BrandDeliverable | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    const r = await api.getBrandDeliverable(dealId, deliverableId);
    if (r.ok) setPost(r.data);
    else setError(r.error);
    return r.ok ? r.data : null;
  }, [dealId, deliverableId]);

  useEffect(() => {
    let live = true;
    api.getBrandDeliverable(dealId, deliverableId).then((r) => {
      if (!live) return;
      if (r.ok) setPost(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [dealId, deliverableId]);

  return { post, error, setPost, reload };
}
