"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { sessionEnded } from "@/lib/brand-deal/session-ended";
import { holdLine, holdsSummary } from "@/lib/brand-deal/hold-view";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import type { BrandDeal, BrandPost } from "@/lib/brand-deal/types";
import { formatAmount } from "@/lib/invite/amount";
import { MoneyHeldLink } from "./money-held";
import { PlatformMark } from "./platform-mark";
import { usePayPalApproval, type ApprovalProps } from "./paypal-approval";
import { PayPalSandboxApproval } from "./paypal-sandbox-approval";

/**
 * "Holds · {held} of {n} held": after agreeing, one line per post, each
 * approved with PayPal on its own. Every state comes from the API; the page
 * only starts an approval and shows what it is told.
 *
 * @param deal - the agreed deal
 * @param onDeal - takes the deal a hold call returned
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17 to CH-FR-19, CH-BR-05
 */
export function HoldsPanel({ deal, onDeal }: { deal: BrandDeal; onDeal: (deal: BrandDeal) => void }) {
  const summary = holdsSummary(
    deal.posts.map((p) => p.hold),
    deal.creatorName,
  );
  return (
    <section aria-labelledby="holds-heading" className="grid gap-1 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 id="holds-heading" className="font-head text-[17px] font-extrabold">
        Holds · {summary.heading}
      </h2>
      {/* CH-FR-32: before approving, the panel in the terms is one tap away. */}
      <MoneyHeldLink />
      {summary.allHeld && (
        <p role="status" className="text-[14.5px] text-ink-2">
          {summary.allHeld}
        </p>
      )}
      <div>
        {deal.posts.map((post) => (
          <HoldRow key={post.deliverableId} deal={deal} post={post} onDeal={onDeal} />
        ))}
      </div>
      <p className="text-meta text-ink-3">A hold reserves the money. It isn’t taken until the live post checks out.</p>
    </section>
  );
}

function HoldRow({ deal, post, onDeal }: { deal: BrandDeal; post: BrandPost; onDeal: (deal: BrandDeal) => void }) {
  // CH-FR-17 (1.3): a build's stand-in (mocks), else PayPal's own button when the API gives a client id.
  const standIn = usePayPalApproval();
  const clientId = deal.paypalClientId;
  const renderApproval =
    standIn ?? (clientId ? (props: ApprovalProps) => <PayPalSandboxApproval {...props} clientId={clientId} /> : null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const label = PLATFORM_LABEL[post.platform];
  const line = holdLine(post.hold, { creator: deal.creatorName, amount: post.amount });

  async function start() {
    setProblem(null);
    if (!renderApproval) return setProblem("PayPal isn’t connected in this build yet, so no hold can be approved.");
    setBusy(true);
    const r = await api.startHold(deal.dealId, post.deliverableId);
    setBusy(false);
    if (r.ok) setOrderId(r.data.orderId);
    // CH-FR-29: the session ended; nothing was started, so Approve with PayPal stays to try again.
    else if (r.error === "signed_out") setProblem(sessionEnded(deal.creatorName));
    else setProblem("That didn’t go through. Nothing was held. Try again.");
  }

  async function finish(approved: boolean) {
    if (!orderId) return;
    setOrderId(null);
    setBusy(true);
    const r = approved ? await api.confirmHold(deal.dealId, post.deliverableId, orderId) : await api.cancelHold(deal.dealId, post.deliverableId, orderId);
    setBusy(false);
    if (r.ok) onDeal(r.data);
    // CH-FR-29: refused before reaching PayPal, so nothing was held; the brand opens the link and starts again.
    else if (r.error === "signed_out") setProblem(sessionEnded(deal.creatorName));
    // The API's answer is lost; never guess at the money. Reload what the API says.
    else {
      const fresh = await api.getBrandDeal(deal.dealId);
      if (fresh.ok) onDeal(fresh.data);
      setProblem("We couldn’t confirm this with PayPal yet. Don’t approve it again; this page will update.");
    }
  }

  return (
    <div role="group" aria-label={label} className="grid grid-cols-[34px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-line-soft py-3.5 first:border-t-0">
      <PlatformMark platform={post.platform} />
      <p className="text-[15px]">
        <b>{label}</b> · {formatAmount(post.amount)}
      </p>
      {line.message && (
        <p role="status" className={`col-start-2 text-[13.5px] ${line.held ? "font-bold text-ink" : line.problem ? "font-bold text-fail" : "text-ink-2"}`}>
          {line.message}
        </p>
      )}
      {problem && (
        <p role="alert" className="col-start-2 text-[13.5px] font-bold text-fail">
          {problem}
        </p>
      )}
      {!line.held && (
        <div className="col-start-2 mt-1.5">
          {orderId && renderApproval ? (
            renderApproval({
              label,
              amount: post.amount,
              orderId,
              onApproved: () => void finish(true),
              onClosed: () => void finish(false),
              onError: () => {
                setOrderId(null);
                setProblem("PayPal didn’t load. Nothing was held. Try again.");
              },
            })
          ) : (
            <button
              type="button"
              disabled={!line.canApprove || busy}
              onClick={start}
              className="inline-flex min-h-11 w-full max-w-80 items-center justify-center rounded-pill bg-espresso px-[18px] text-[15px] font-bold text-white hover:bg-espresso-hover disabled:bg-ink-4 disabled:opacity-60"
            >
              Approve with PayPal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
