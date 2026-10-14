"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { refusal, type RefusalNames, type RefusedAction } from "@/lib/publish/refusals";

/** "I've posted it" opens in place: a confirmation for YouTube, a link for a Reel (PP-FR-06, PP-FR-07). */
const INSTAGRAM_POST = /^https:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+\/?$/;

/**
 * The creator's actions on the journey, each from what the API returns:
 * the go-ahead, posting, checking again and sending a payout again (with the
 * PayPal email corrected first when it bounced). Nothing here decides money.
 *
 * @param d - the deliverable
 * @param onUpdated - takes the deliverable the API returned
 * @param names - the creator's connected channel and Instagram account, for refusals (PP-FR-37)
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-20, PP-FR-37
 */
export function useJourneyActions(d: Deliverable, onUpdated: (d: Deliverable) => void, names: Omit<RefusalNames, "brand"> = {}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // PP-FR-37: a refusal that needs an account reconnected offers it beside the words.
  const [reconnect, setReconnect] = useState<"youtube" | "instagram" | null>(null);
  const [posting, setPosting] = useState(false);

  async function run(call: () => ReturnType<typeof api.getGoAhead>, action?: RefusedAction, refused = "That didn’t go through. The page has the latest.") {
    setBusy(true);
    setProblem(null);
    setReconnect(null);
    const r = await call();
    setBusy(false);
    if (r.ok) {
      setPosting(false);
      onUpdated(r.data);
      return true;
    }
    // PP-FR-37: the API's code in plain words, when it gave one this page knows.
    const words = action && "code" in r ? refusal(action, r.code, { brand: d.brandName, ...names }) : null;
    if (r.error === "rejected") {
      const fresh = await api.getDeliverable(d.id);
      if (fresh.ok) onUpdated(fresh.data);
      setProblem(words?.text ?? refused);
      setReconnect(words?.reconnect ?? null);
    } else setProblem(words?.text ?? "We couldn’t reach Sponing. Try again.");
    return false;
  }

  return {
    busy,
    problem,
    reconnect,
    posting,
    openPosting: () => {
      setProblem(null);
      setPosting(true);
    },
    closePosting: () => setPosting(false),
    getGoAhead: (videoUrl?: string) => run(() => api.getGoAhead(d.id, videoUrl?.trim()), "go_ahead"),
    postedYouTube: () => run(() => api.markPosted(d.id), "posted"),
    postedReel: (url: string) => {
      const link = url.trim();
      if (!INSTAGRAM_POST.test(link)) return setProblem("That doesn’t look like a link to an Instagram Reel.");
      return run(() => api.markPosted(d.id, link), "posted", "That Reel isn’t on your account. Check the link.");
    },
    checkAgain: () => run(() => api.checkLiveAgain(d.id), "check_again"),
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
