"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { DealDraft } from "@/lib/checklist-builder/types";

const POLL_MS = 500;

/**
 * Loads a deal draft and, while its brief is being read, polls until the
 * reading is done (BC-FR-07). `replace` takes the draft a change returned.
 *
 * @param dealId - the deal
 */
export function useDealDraft(dealId: string) {
  const [state, setState] = useState<{ draft: DealDraft | null; error: ApiError | null }>({ draft: null, error: null });
  const load = useCallback(async () => {
    const r = await api.getDealDraft(dealId);
    setState(r.ok ? { draft: r.data, error: null } : { draft: null, error: r.error });
  }, [dealId]);

  useEffect(() => {
    let live = true;
    api.getDealDraft(dealId).then((r) => live && setState(r.ok ? { draft: r.data, error: null } : { draft: null, error: r.error }));
    return () => {
      live = false;
    };
  }, [dealId]);

  const reading = state.draft?.reading === "reading";
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [reading, load]);

  return { ...state, replace: (draft: DealDraft) => setState({ draft, error: null }), reload: load };
}
