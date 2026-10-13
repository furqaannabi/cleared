"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { sessionEnded } from "@/lib/brand-deal/session-ended";
import { holdLine, holdsSummary } from "@/lib/brand-deal/hold-view";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import type { BrandDeal, BrandPost } from "@/lib/brand-deal/types";
import { formatAmount } from "@/lib/invite/amount";
import { MoneyHeldLink } from "./money-held";
import { PlatformMark } from "./platform-mark";
import { PayPalHoldButtons, PayPalScript } from "./paypal-sandbox-approval";

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
      {/* CH-FR-17 (1.9): PayPal's script loads once, as soon as the holds show. */}
      {deal.paypalClientId ? (
        <PayPalScript clientId={deal.paypalClientId}>
          <HoldRows deal={deal} onDeal={onDeal} />
        </PayPalScript>
      ) : (
        <HoldRows deal={deal} onDeal={onDeal} />
      )}
      <p className="text-meta text-ink-3">A hold reserves the money. It isn’t taken until the live post checks out.</p>
    </section>
  );
}

function HoldRows({ deal, onDeal }: { deal: BrandDeal; onDeal: (deal: BrandDeal) => void }) {
  return (
    <div>
      {deal.posts.map((post) => (
        <HoldRow key={post.deliverableId} deal={deal} post={post} onDeal={onDeal} />
      ))}
    </div>
  );
}

function HoldRow({ deal, post, onDeal }: { deal: BrandDeal; post: BrandPost; onDeal: (deal: BrandDeal) => void }) {
  const orderId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const label = PLATFORM_LABEL[post.platform];
  const line = holdLine(post.hold, { creator: deal.creatorName, amount: post.amount });

  // CH-FR-17 (1.9): PayPal's button asks for the order on the same click that opens PayPal.
  async function createOrder() {
    setProblem(null);
    const r = await api.startHold(deal.dealId, post.deliverableId);
    if (r.ok) return (orderId.current = r.data.orderId);
    // CH-FR-29: the session ended; nothing was started, so PayPal's buttons stay to try again.
    setProblem(r.error === "signed_out" ? sessionEnded(deal.creatorName) : "That didn’t go through. Nothing was held. Try again.");
    throw new Error("The API refused the order");
  }

  async function finish(approved: boolean) {
    const order = orderId.current;
    if (!order) return;
    orderId.current = null;
    setBusy(true);
    const r = approved ? await api.confirmHold(deal.dealId, post.deliverableId, order) : await api.cancelHold(deal.dealId, post.deliverableId, order);
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
      {/* CH-FR-18 (1.9): no buttons while PayPal owes an answer. */}
      {line.canApprove && !busy && (
        <div className="col-start-2 mt-1.5 grid gap-1.5">
          <p className="text-[13.5px] text-ink-2">Approve the hold with PayPal or a card</p>
          {deal.paypalClientId ? (
            <PayPalHoldButtons createOrder={createOrder} onApproved={() => void finish(true)} onClosed={() => void finish(false)} />
          ) : (
            <p className="text-[13.5px] font-bold text-fail">PayPal isn’t connected in this build yet, so no hold can be approved.</p>
          )}
        </div>
      )}
    </div>
  );
}
