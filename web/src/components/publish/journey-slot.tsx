"use client";

import { useEffect, useMemo, useState } from "react";
import { useOptionalSession } from "@/components/session/use-session";
import { api } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { journey } from "@/lib/publish/journey";
import { JourneyPanel } from "./journey-panel";
import { useJourneyActions } from "./use-journey-actions";

/**
 * The journey on the creator's page: keeps its countdown moving, asks the
 * API again while something is on its way (the live check, a payout), and
 * puts the current action in the phone bar too.
 *
 * @param d - the deliverable, past Approved
 * @param onUpdated - takes the deliverable the API returned
 * @param timeZone - the viewer's timezone (tests)
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-23, PP-FR-33, PP-FR-36
 */
export function JourneySlot({ d, onUpdated, timeZone }: { d: Deliverable; onUpdated: (d: Deliverable) => void; timeZone?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  // The API owns the timing; while a check or payout is on its way, ask it again.
  // PP-FR-01, PP-FR-12 (1.3): also while PayPal confirms the hold and while a check again runs.
  const waiting =
    d.liveCheck?.state === "checking" ||
    (d.liveCheck?.state === "fixable" && !!d.liveCheck.checking) ||
    d.goAhead?.state === "confirming" ||
    // PP-FR-39: approved, waiting for the capture.
    (d.state === "published" && (d.liveCheck?.state === "passed" || d.liveCheck?.state === "approved") && !d.capture) ||
    d.payout?.state === "sending" ||
    d.payout?.state === "cancelling";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const r = await api.getDeliverable(d.id);
      if (r.ok) onUpdated(r.data);
    }, 2500);
    return () => clearInterval(t);
  }, [waiting, d.id, onUpdated]);
  // PP-FR-37, PP-FR-38: the connected channel and account by name, when the profile has them.
  const session = useOptionalSession();
  const accounts = session?.load.status === "signed_in" ? session.load.me.accounts : [];
  const channel = accounts.find((x) => x.platform === "youtube")?.name;
  const account = accounts.find((x) => x.platform === "instagram")?.name;
  const view = useMemo(() => journey(d, now, { timeZone, channel: d.platform === "instagram_reel" ? account : channel }), [d, now, timeZone, channel, account]);
  const actions = useJourneyActions(d, onUpdated, { channel, account });
  const a = view.action;
  return (
    <>
      <JourneyPanel d={d} view={view} actions={actions} />
      {/* PP-FR-33: on phones the current action is also in the bar; anything that needs more opens in the panel. */}
      {/* PP-FR-01 (1.3): the go-ahead needs its link and reconnecting is a link, so both stay in the panel. */}
      {a && !actions.posting && !a.fixEmail && !a.videoLink && a.kind !== "reconnect" && (
        <div className="fixed inset-x-3 bottom-3 z-10 md:hidden">
          <button
            type="button"
            disabled={a.disabled || actions.busy}
            onClick={() => {
              if (a.kind === "get_go_ahead") void actions.getGoAhead();
              else if (a.kind === "posted") actions.openPosting();
              else if (a.kind === "check_again") void actions.checkAgain();
              else void actions.sendAgain();
              document.getElementById("journey")?.scrollIntoView?.({ block: "start" });
            }}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-espresso px-[22px] font-bold text-white shadow-floating-bar disabled:opacity-50"
          >
            {a.label}
          </button>
        </div>
      )}
    </>
  );
}
