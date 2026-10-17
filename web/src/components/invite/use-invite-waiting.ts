"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { dealHref } from "@/components/shell/deal-href";
import type { DealInvite } from "@/lib/invite/types";

const POLL_MS = 5000;

/** The posts still open: not cancelled, and not closed without a hold. */
const openPosts = (invite: DealInvite) => invite.posts.filter((p) => !p.cancelled && p.hold?.state !== "closed" && p.hold?.state !== "not_held");

/**
 * IN-FR-24 (1.6): while the page waits on the brand it asks for the invite
 * again every 5 seconds, while the tab is shown; once every open post is held
 * it opens the post the deals list names (DC-FR-37), replacing itself in the
 * history.
 *
 * @param invite - the deal's invite as last answered, or null while loading
 * @param onInvite - takes a fresh answer (and reloads the rail if the step changed)
 * @see docs/specs/creator-invite-frd.md IN-FR-24
 */
export function useInviteWaiting(invite: DealInvite | null, onInvite: (next: DealInvite) => void) {
  const router = useRouter();
  const open = invite ? openPosts(invite) : [];
  const allHeld = invite?.step === "agreed" && open.length > 0 && open.every((p) => p.hold?.state === "held");
  const dealId = invite?.dealId;
  const waiting = invite?.step === "waiting_for_brand" || (invite?.step === "agreed" && open.some((p) => p.hold?.state !== "held"));

  // A failed ask changes nothing; the next one tries again. Nothing is asked while the tab is hidden.
  useEffect(() => {
    if (!waiting || !dealId) return;
    const timer = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      const r = await api.getInvite(dealId);
      if (r.ok) onInvite(r.data);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, dealId, onInvite]);

  useEffect(() => {
    if (!allHeld || !dealId) return;
    let live = true;
    api.getDeals().then((r) => {
      const deal = r.ok ? r.data.find((d) => d.id === dealId) : undefined;
      const href = deal && dealHref(deal);
      if (live && href) router.replace(href);
    });
    return () => {
      live = false;
    };
  }, [allHeld, dealId, router]);
}
