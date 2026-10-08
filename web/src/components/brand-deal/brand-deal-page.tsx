"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { holdsSummary } from "@/lib/brand-deal/hold-view";
import { brandTermsView } from "@/lib/brand-deal/terms-view";
import type { BrandDeal } from "@/lib/brand-deal/types";
import { AgreePanel } from "./agree-panel";
import { BrandFrame, BrandMessage } from "./brand-frame";
import { BrandTermsSheet } from "./brand-terms-sheet";
import { DraftsPanel } from "./drafts-panel";
import { HoldsPanel } from "./holds-panel";
import { NotesPanel } from "./notes-panel";
import { NotesProvider, useNotes } from "./notes";
import { useBrandDeal } from "./use-brand-deal";

/** What the brand does next, under the title (CH-FR-12, CH-FR-16). */
const LEDE: Record<BrandDeal["step"], (creator: string) => string> = {
  waiting_for_brand: () =>
    "Read the terms and each post’s checklist. Ask for a change on anything that’s wrong, or agree. No money moves until you approve a hold for each post.",
  changes_requested: (creator) => `${creator} is looking at the changes you asked for. This page shows the new version when they send it.`,
  agreed: () => "You agreed to these terms. Approve a hold for each post: the money is reserved, not taken, until that post’s live check passes.",
};

/**
 * The brand's deal page, opened from the creator's link (design A): the
 * terms sheet with every checklist and where each item came from, and beside
 * it (below it on phones) the brand's notes and Agree.
 *
 * @param dealId - the deal, from the URL
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-03 to CH-FR-16
 */
export function BrandDealPage({ dealId }: { dealId: string }) {
  const { deal, error, setDeal } = useBrandDeal(dealId);

  if (error === "not_found")
    return (
      <BrandFrame>
        <BrandMessage title="Open the link you were sent again">For your security, this page only opens from the link the creator sent you.</BrandMessage>
      </BrandFrame>
    );
  if (error)
    return (
      <BrandFrame>
        <BrandMessage title="We couldn’t load this deal">Check your connection and reload the page.</BrandMessage>
      </BrandFrame>
    );
  if (!deal)
    return (
      <BrandFrame>
        <p role="status" className="py-10 text-ink-3">
          Loading your deal…
        </p>
      </BrandFrame>
    );

  return (
    <BrandFrame invited={{ creator: deal.creatorName, brand: deal.brandName }}>
      <title>{`${deal.brandName} × ${deal.creatorName} · Cleared`}</title>
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">Your deal with {deal.creatorName}</h1>
      <p className="mt-2 max-w-[60ch] text-[15.5px] text-ink-2">
        {/* RW-FR-01: once the drafts start coming, the page is where they're reviewed. */}
        {deal.posts.some((p) => p.review) ? "Each post’s draft comes here for your review. Each has its own hold and its own 48 hours." : LEDE[deal.step](deal.creatorName)}
      </p>
      <NotesProvider editable={deal.step === "waiting_for_brand"}>
        <DealBody deal={deal} onDeal={setDeal} />
      </NotesProvider>
    </BrandFrame>
  );
}

function DealBody({ deal, onDeal }: { deal: BrandDeal; onDeal: (deal: BrandDeal) => void }) {
  const notes = useNotes();
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [agreeing, setAgreeing] = useState(false);
  const [agreeProblem, setAgreeProblem] = useState<string | null>(null);
  const view = brandTermsView(deal);
  const waitingOnPayPal = holdsSummary(
    deal.posts.map((p) => p.hold),
    deal.creatorName,
  ).waiting;

  // CH-FR-18: while PayPal owes an answer, ask the API again every few seconds.
  useEffect(() => {
    if (!waitingOnPayPal) return;
    const timer = setInterval(async () => {
      const r = await api.getBrandDeal(deal.dealId);
      if (r.ok) onDeal(r.data);
    }, 3000);
    return () => clearInterval(timer);
  }, [waitingOnPayPal, deal.dealId, onDeal]);

  // CH-FR-14 to CH-FR-16: agree to the version shown; unsent notes are dropped.
  async function agree() {
    setAgreeing(true);
    setAgreeProblem(null);
    const r = await api.agree(deal.dealId, deal.version);
    setAgreeing(false);
    if (r.ok) {
      notes.clear();
      return onDeal(r.data);
    }
    if (r.error !== "rejected") return setAgreeProblem("We couldn’t reach Cleared. Try again.");
    // CH-FR-15: most likely the creator sent a new version while the brand was reading.
    const fresh = await api.getBrandDeal(deal.dealId);
    if (fresh.ok && fresh.data.version !== deal.version) {
      onDeal(fresh.data);
      setAgreeProblem(`${deal.creatorName} updated the terms. Check the changes before agreeing.`);
    } else {
      if (fresh.ok) onDeal(fresh.data);
      setAgreeProblem("That didn’t go through. Try again.");
    }
  }

  async function send() {
    setSending(true);
    setFailed(false);
    const r = await api.sendChanges(
      deal.dealId,
      notes.drafts.map(({ about, text }) => ({ about, text })),
    );
    setSending(false);
    if (!r.ok) return setFailed(true);
    notes.clear();
    onDeal(r.data);
  }

  return (
    <div className="mt-[22px] grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-8">
      <BrandTermsSheet deal={deal} view={view} />
      <div className={`grid gap-4 lg:sticky lg:top-6 ${deal.step === "agreed" ? "order-first lg:order-none" : ""}`}>
        <DraftsPanel deal={deal} />
        {deal.step === "agreed" && <HoldsPanel deal={deal} onDeal={onDeal} />}
        <NotesPanel deal={deal} sending={sending} failed={failed} onSend={send} />
        {deal.step === "waiting_for_brand" && <AgreePanel summary={view.summary} agreeing={agreeing} problem={agreeProblem} onAgree={agree} />}
      </div>
    </div>
  );
}
