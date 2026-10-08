"use client";

import { useState } from "react";
import type { Deliverable } from "@/lib/deliverable/types";
import { api } from "@/lib/api";
import { setDemoGoAhead, setDemoLiveCheck, setDemoPayout, tryPayoutNow } from "@/mocks/demo-publish";

const SELECT = "min-h-11 rounded-sm border border-latte-line bg-surface px-2 text-[14px] text-ink";

/**
 * Mock builds only: what the demo's next go-ahead, live check and payout
 * answer, so every state of the journey can be shown, and a delayed payout
 * tried again now rather than in 6 hours. Never in a real build; nothing
 * reaches PayPal or a platform.
 *
 * @param d - the deliverable, past Approved
 * @param onUpdated - takes the deliverable after a payout is tried again
 * @see docs/specs/publish-and-pay-frd.md PP-FR-32
 */
export function DemoPublishControls({ d, onUpdated }: { d: Deliverable; onUpdated: (d: Deliverable) => void }) {
  const [goAhead, setGoAhead] = useState("go");
  const [live, setLive] = useState("passed");
  const [payout, setPayout] = useState("paid");
  const beforePosting = d.state === "approved" || d.state === "posting";
  const checking = beforePosting || (d.state === "published" && d.liveCheck?.state === "fixable");
  const delayed = d.state === "captured" && d.payout?.state === "delayed";
  const paying = beforePosting || delayed || (d.state === "captured" && d.payout?.canSendAgain);
  const tryNow = async () => {
    await tryPayoutNow(d.id);
    const r = await api.getDeliverable(d.id);
    if (r.ok) onUpdated(r.data);
  };
  if (!d.state || (!beforePosting && !checking && !paying)) return null;
  return (
    <div className="mt-4 grid gap-2 rounded-md border border-dashed border-latte-line bg-latte-wash px-3 py-2 text-meta text-ink-2 sm:flex sm:flex-wrap sm:items-center">
      <b className="text-ink">Demo (mocks only)</b>
      {d.state === "approved" && (
        <label className="flex flex-wrap items-center gap-2">
          the go-ahead answers
          <select value={goAhead} onChange={(e) => (setGoAhead(e.target.value), void setDemoGoAhead(e.target.value as "go"))} className={SELECT}>
            <option value="go">go-ahead</option>
            <option value="wait">wait until</option>
            <option value="not_confirmed">not confirmed</option>
          </select>
        </label>
      )}
      {checking && (
        <label className="flex flex-wrap items-center gap-2">
          the live check finds
          <select value={live} onChange={(e) => (setLive(e.target.value), void setDemoLiveCheck(e.target.value as "passed"))} className={SELECT}>
            <option value="passed">it passes</option>
            <option value="fixable">something to fix</option>
            <option value="not_fixable">something that can’t be fixed</option>
            <option value="undecided">something it can’t decide</option>
          </select>
        </label>
      )}
      {paying && (
        <label className="flex flex-wrap items-center gap-2">
          the payout is
          <select value={payout} onChange={(e) => (setPayout(e.target.value), void setDemoPayout(e.target.value as "paid"))} className={SELECT}>
            <option value="paid">paid</option>
            <option value="unclaimed">unclaimed</option>
            <option value="failed">bounced</option>
            <option value="wont_send">not sent by PayPal</option>
          </select>
        </label>
      )}
      {delayed && (
        <button type="button" onClick={() => void tryNow()} className="min-h-11 justify-self-start rounded-pill border border-latte-line bg-surface px-4 font-bold text-ink">
          Try the payout again now
        </button>
      )}
    </div>
  );
}
