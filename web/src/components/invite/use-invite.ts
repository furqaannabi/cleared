"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api";
import type { CreatorProfile, DealInvite } from "@/lib/invite/types";

/**
 * Loads a deal's invite terms and the creator's profile together. `setInvite`
 * and `setProfile` take what a saved change returned.
 *
 * @param dealId - the deal
 * @see docs/specs/creator-invite-frd.md IN-FR-04, IN-FR-10, IN-FR-12
 */
export function useInvite(dealId: string) {
  const [invite, setInvite] = useState<DealInvite | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    const [i, p] = await Promise.all([api.getInvite(dealId), api.getProfile()]);
    if (i.ok && p.ok) {
      setInvite(i.data);
      setProfile(p.data);
      setError(null);
    } else setError(!i.ok ? i.error : !p.ok ? p.error : null);
  }, [dealId]);

  useEffect(() => {
    let live = true;
    Promise.all([api.getInvite(dealId), api.getProfile()]).then(([i, p]) => {
      if (!live) return;
      if (i.ok && p.ok) {
        setInvite(i.data);
        setProfile(p.data);
      } else setError(!i.ok ? i.error : !p.ok ? p.error : null);
    });
    return () => {
      live = false;
    };
  }, [dealId]);

  return { invite, profile, error, setInvite, setProfile, reload: load };
}
