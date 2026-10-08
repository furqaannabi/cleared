"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";

/** "I've posted it" opens in place: a confirmation for YouTube, a link for a Reel (PP-FR-06, PP-FR-07). */
const INSTAGRAM_POST = /^https:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+\/?$/;

/**
 * The creator's actions on the journey, each from what the API returns:
 * the go-ahead, posting, checking again and sending a payout again (with the
 * PayPal email corrected first when it bounced). Nothing here decides money.
 *
 * @param d - the deliverable
 * @param onUpdated - takes the deliverable the API returned
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-20
 */
export function useJourneyActions(d: Deliverable, onUpdated: (d: Deliverable) => void) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  async function run(call: () => ReturnType<typeof api.getGoAhead>, refused = "That didn’t go through. The page has the latest.") {
    setBusy(true);
    setProblem(null);
    const r = await call();
    setBusy(false);
    if (r.ok) {
      setPosting(false);
      onUpdated(r.data);
      return true;
    }
    if (r.error === "rejected") {
      const fresh = await api.getDeliverable(d.id);
      if (fresh.ok) onUpdated(fresh.data);
      setProblem(refused);
    } else setProblem("We couldn’t reach Cleared. Try again.");
    return false;
  }

  return {
    busy,
    problem,
    posting,
    openPosting: () => {
      setProblem(null);
      setPosting(true);
    },
    closePosting: () => setPosting(false),
    getGoAhead: () => run(() => api.getGoAhead(d.id)),
    postedYouTube: () => run(() => api.markPosted(d.id)),
    postedReel: (url: string) => {
      const link = url.trim();
      if (!INSTAGRAM_POST.test(link)) return setProblem("That doesn’t look like a link to an Instagram Reel.");
      return run(() => api.markPosted(d.id, link), "That Reel isn’t on your account. Check the link.");
    },
    checkAgain: () => run(() => api.checkLiveAgain(d.id)),
    async sendAgain(email?: string) {
      if (email !== undefined) {
        setBusy(true);
        const saved = await api.setPaypalEmail(email.trim());
        setBusy(false);
        if (!saved.ok) return setProblem("That email wasn’t saved. Check it and try again.");
      }
      return run(() => api.sendPayoutAgain(d.id));
    },
  };
}

export type JourneyActions = ReturnType<typeof useJourneyActions>;
