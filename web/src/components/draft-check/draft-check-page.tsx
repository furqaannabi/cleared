"use client";

import { useMemo, useState } from "react";
import { ChecklistFilter } from "@/components/checklist/checklist-filter";
import { ChecklistItems } from "@/components/checklist/checklist-items";
import { hasItemActions, ItemActions } from "@/components/checklist/item-actions";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { tabsFor, type ChecklistTab } from "@/lib/checklist/item-status";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { MoneyCard } from "@/components/money/money-card";
import { BriefSheet } from "@/components/brief/brief-sheet";
import { NextStepBar } from "@/components/next-step/next-step-bar";
import { DraftPlayer } from "@/components/player/draft-player";
import { api } from "@/lib/api";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { MOCKING_ENABLED } from "@/lib/mocking/mocking-enabled";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import type { Deliverable } from "@/lib/deliverable/types";
import { LoadProblem } from "./load-problem";
import { PageSkeleton } from "./page-skeleton";
import { useDeliverable } from "./use-deliverable";
import { useItemActions } from "./use-item-actions";

/**
 * The creator's draft check page for one deliverable: loads it and shows
 * the loading, not-found, error and loaded states.
 *
 * @param deliverableId - the deliverable's opaque id from the route
 * @see docs/specs/creator-draft-check-frd.md DC-FR-01, DC-FR-38, DC-FR-39
 */
export function DraftCheckPage({ deliverableId }: { deliverableId: string }) {
  const { load, retry, replace } = useDeliverable(deliverableId);
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-36 md:px-6 lg:px-9">
      {load.status === "loading" && <PageSkeleton />}
      {load.status === "ready" && <Loaded deliverable={load.deliverable} onUpdated={replace} />}
      {load.status === "error" && <LoadProblem error={load.error} onRetry={retry} />}
    </main>
  );
}

function Loaded({ deliverable, onUpdated }: { deliverable: Deliverable; onUpdated: (d: Deliverable) => void }) {
  // Recomputed per load; `now` is read once so the page doesn't shift while open.
  const view = useMemo(() => deliverableView(deliverable, new Date()), [deliverable]);
  const [selectedId, setSelectedId] = useState<string | null>(view.defaultItemId);
  const [filter, setFilter] = useState<ChecklistTab>("all");
  const shown = view.items.filter((i) => tabsFor(i.status).includes(filter));
  const wide = useMediaQuery("(min-width: 768px)");
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  const actions = useItemActions(deliverable.id, onUpdated);
  // DC-FR-30: View brief, beside the next step from md: up and in the checklist header on phones.
  const briefSheet = deliverable.brief && (
    <BriefSheet brief={deliverable.brief} brandName={deliverable.brandName} highlightLine={selected?.briefLine.number ?? null} />
  );
  // DC-FR-09: retry a check that failed on our side; the page shows what the API returns.
  const [retrying, setRetrying] = useState(false);
  const [retryProblem, setRetryProblem] = useState<string | null>(null);
  const retryCheck = async () => {
    setRetrying(true);
    setRetryProblem(null);
    const result = await api.retryCheck(deliverable.id);
    setRetrying(false);
    if (result.ok) onUpdated(result.data);
    else setRetryProblem("We couldn’t restart the check. Try again in a moment.");
  };
  // DC-FR-45: while the upload flow is unspecced, uploading is simulated, and only on mocks.
  // The literal NODE_ENV check lets the bundler drop the simulation and mock data from production builds.
  const simulateUpload =
    process.env.NODE_ENV !== "production" && MOCKING_ENABLED
      ? async (file: File) => {
        void file; // never read or sent anywhere
        const { simulateUpload: simulate } = await import("@/mocks/simulate-upload");
        simulate(deliverable.id, onUpdated);
      }
    : undefined;
  // DC-FR-26: a fresh link for the draft when the current one stops working.
  const refreshDraftUrl = async () => {
    const result = await api.refreshDraftUrl(deliverable.id);
    return result.ok ? result.data.url : null;
  };
  const renderActions = (item: ItemView) =>
    hasItemActions(item) && (
    <ItemActions
      item={item}
      brandName={deliverable.brandName}
      onAsk={() => actions.ask(item.id)}
      onWithdraw={() => actions.withdraw(item.id)}
      pending={actions.pendingId === item.id}
      problem={actions.problemFor(item.id)}
    />
  );
  return (
    <>
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{view.title}</h1>
      {/*
        DESIGN.md layout. Phone and tablet: one column (money, player, next step,
        evidence). Desktop: player above the next step on the left; money above
        the evidence panel on the right; the checklist full width below. Below lg:
        the two column wrappers dissolve (display: contents) and `order` sets the
        single-column sequence.
      */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          {deliverable.draft && (
            <div className="order-2">
              <DraftPlayer
                draft={deliverable.draft}
                platform={deliverable.platform}
                items={view.items}
                brandName={deliverable.brandName}
                selectedId={selectedId}
                onSelect={setSelectedId}
                refreshUrl={refreshDraftUrl}
              />
            </div>
          )}
          <div className="order-3">
            <NextStepBar
              step={view.nextStep}
              onTryAgain={retryCheck}
              pending={retrying}
              problem={retryProblem}
              secondary={wide ? briefSheet : undefined}
              onUpload={simulateUpload}
            />
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <div className="order-1">
            <MoneyCard deliverable={deliverable} />
          </div>
          {/* DC-FR-12: tablet and up only; on phones the expanded card shows the evidence. */}
          {wide && (
            <div className="order-4">
              <EvidencePanel item={selected} brandName={deliverable.brandName} actions={selected ? renderActions(selected) : null} />
            </div>
          )}
        </div>
      </div>
      <section aria-label="Checklist" className="mt-8">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-head text-section-title font-bold">
            Checklist<small className="ml-1.5 font-sans text-[14px] font-semibold text-ink-3">{view.items.length} items</small>
          </h2>
          {!wide && briefSheet}
          {view.tabs.length > 0 && <ChecklistFilter tabs={view.tabs} value={filter} onChange={setFilter} />}
        </div>
        <div className="mt-3.5">
          {shown.length > 0 ? (
            <ChecklistItems
              items={shown}
              brandName={deliverable.brandName}
              selectedId={selectedId}
              onSelect={setSelectedId}
              renderActions={renderActions}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-line p-7 text-center text-ink-3">Nothing here right now.</p>
          )}
        </div>
      </section>
    </>
  );
}
