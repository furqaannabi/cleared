"use client";

import { useCallback, useMemo, useState } from "react";
import { ChecklistFilter } from "@/components/checklist/checklist-filter";
import { ChecklistItems } from "@/components/checklist/checklist-items";
import { hasItemActions, ItemActions } from "@/components/checklist/item-actions";
import type { ItemView } from "@/lib/deliverable/deliverable-view";
import { byNeed, tabsFor, type ChecklistTab } from "@/lib/checklist/item-status";
import { DealHeader } from "@/components/deal/deal-header";
import { DeliverableSwitcher } from "@/components/deal/deliverable-switcher";
import { useOptionalDeals } from "@/components/shell/use-deals";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { MoneyCard } from "@/components/money/money-card";
import { BriefSheet } from "@/components/brief/brief-sheet";
import { NextStepBar } from "@/components/next-step/next-step-bar";
import { WhatHappensNext } from "@/components/next-step/what-happens-next";
import { DraftPlaceholder } from "@/components/player/draft-placeholder";
import { DraftPlayer } from "@/components/player/draft-player";
import { SeekProvider } from "@/components/player/seek";
import { api } from "@/lib/api";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { MOCKING_ENABLED } from "@/lib/mocking/mocking-enabled";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import type { Deliverable } from "@/lib/deliverable/types";
import { CheckFailedBanner } from "./check-failed-banner";
import { CheckStages } from "./check-stages";
import { DraftCheckLayout } from "./draft-check-layout";
import { PassedBanner } from "./passed-banner";
import { RunChangeBanner } from "./run-change-banner";
import { LoadProblem } from "./load-problem";
import { PageSkeleton } from "./page-skeleton";
import { useDeliverable } from "./use-deliverable";
import { useItemActions } from "./use-item-actions";

/**
 * The creator's draft check page for one deliverable: loads it and shows
 * the loading, not-found, error and loaded states.
 *
 * @param dealId - the deal's opaque id from the route
 * @param deliverableId - the deliverable's opaque id from the route
 * @see docs/specs/creator-draft-check-frd.md DC-FR-01, DC-FR-38, DC-FR-39
 */
export function DraftCheckPage({ dealId, deliverableId }: { dealId: string; deliverableId: string }) {
  const { load, retry, replace } = useDeliverable(deliverableId);
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] focus:outline-none px-4 pt-4 pb-36 md:px-6 lg:px-9">
      {load.status === "loading" && <PageSkeleton />}
      {load.status === "ready" && <Loaded dealId={dealId} deliverable={load.deliverable} onUpdated={replace} />}
      {load.status === "error" && <LoadProblem error={load.error} onRetry={retry} />}
    </main>
  );
}

function Loaded({
  dealId,
  deliverable,
  onUpdated,
}: {
  dealId: string;
  deliverable: Deliverable;
  onUpdated: (d: Deliverable) => void;
}) {
  // Recomputed per load; `now` is read once so the page doesn't shift while open.
  const view = useMemo(() => deliverableView(deliverable, new Date()), [deliverable]);
  const [selectedId, setSelectedId] = useState<string | null>(view.defaultItemId);
  const [filter, setFilter] = useState<ChecklistTab>("all");
  // DC-FR-21, DC-FR-48: when a run lands while the page is open (Checking turns into results),
  // the old selection belonged to the previous run: select again, show All, and let the summary's seal stamp.
  const [seenState, setSeenState] = useState(deliverable.state);
  const [landed, setLanded] = useState(false);
  if (deliverable.state !== seenState) {
    setSeenState(deliverable.state);
    if (seenState === "checking") {
      setLanded(true);
      setSelectedId(view.defaultItemId);
      setFilter("all");
    }
  }
  const shown = view.items.filter((i) => tabsFor(i.status).includes(filter));
  const wide = useMediaQuery("(min-width: 768px)");
  // DC-FR-33: the deal's other deliverables, from the shell's deals.
  const dealsLoad = useOptionalDeals();
  const deal = dealsLoad?.status === "ready" ? dealsLoad.deals.find((d) => d.id === dealId) : undefined;
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  const actions = useItemActions(deliverable.id, deliverable.brandName, onUpdated);
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
      onAsk={() => actions.ask(item)}
      onWithdraw={() => actions.withdraw(item)}
      pending={actions.pendingId === item.id}
      problem={actions.problemFor(item.id)}
    />
  );
  // The next step's lead opens the first item that needs the creator.
  // Only when the results on screen are current (not after a failed check or release).
  const needsYou =
    deliverable.state === "results"
      ? byNeed(view.items).find((i) => ["fix_needed", "unsure", "waiting_for_brand"].includes(i.status))
      : undefined;
  const showItem = needsYou
    ? () => {
        setFilter("all");
        setSelectedId(needsYou.id);
        requestAnimationFrame(() => {
          const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          document.getElementById(`item-${needsYou.id}`)?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
        });
      }
    : undefined;

  // DC-FR-23: "Play from" selects the item and plays the draft from its moment.
  const [seekKey, setSeekKey] = useState(0);
  const seek = useCallback((itemId: string) => {
    setSelectedId(itemId);
    setSeekKey((k) => k + 1);
  }, []);

  // DC-FR-02: before a draft, the player's space says so.
  const playerSlot =
    deliverable.state === "no_draft" ? (
      <DraftPlaceholder platform={deliverable.platform} />
    ) : deliverable.draft ? (
      <DraftPlayer
        draft={deliverable.draft}
        platform={deliverable.platform}
        items={view.items}
        brandName={deliverable.brandName}
        selectedId={selectedId}
        onSelect={setSelectedId}
        refreshUrl={refreshDraftUrl}
        seekKey={seekKey}
      />
    ) : null;
  return (
    // Timestamps can play the draft only when there is one (DC-FR-23).
    <SeekProvider seek={playerSlot && deliverable.draft ? seek : null}>
      <DealHeader
        view={view}
        dealId={dealId}
        brandName={deliverable.brandName}
        deliverableName={view.deliverableName}
        switcher={deal && <DeliverableSwitcher dealId={dealId} deliverables={deal.deliverables} currentId={deliverable.id} />}
      />
      {view.checkFailed && <CheckFailedBanner banner={view.checkFailed} />}
      {view.runChange && <RunChangeBanner change={view.runChange} landed={landed} />}
      {view.passed && <PassedBanner passed={view.passed} brandName={deliverable.brandName} />}
      <DraftCheckLayout
        vertical={deliverable.platform !== "youtube_video"}
        money={
          wide ? (
            <MoneyCard deliverable={deliverable} />
          ) : (
            // DC-FR-47: phones get the next step's whole explanation here; the bar keeps only its lead.
            <div className="flex flex-col gap-3">
              <MoneyCard deliverable={deliverable} compact />
              {!view.checkFailed && <WhatHappensNext step={view.nextStep} />}
            </div>
          )
        }
        player={playerSlot}
        next={
          <NextStepBar
            step={view.nextStep}
            onTryAgain={retryCheck}
            pending={retrying}
            problem={retryProblem}
            secondary={wide ? briefSheet : undefined}
            onUpload={simulateUpload}
            onShowItem={showItem}
          />
        }
        evidence={
          // DC-FR-04: while checking, the stages take the evidence panel's place, at every width.
          view.checking ? (
            <CheckStages checking={view.checking} />
          ) : (
            // DC-FR-12: tablet and up only; on phones the expanded card shows the evidence.
            wide && (
              <EvidencePanel item={selected} brandName={deliverable.brandName} actions={selected ? renderActions(selected) : null} />
            )
          )
        }
      />
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
      {/* DC-BR-10: mock data is labelled as synthetic on screen. Never shown with real data. */}
      {MOCKING_ENABLED && (
        <p className="mt-7 text-chip text-ink-4">
          Demo data. Glow Theory, Northbound Coffee, Kora Audio and Ada Okafor are made up, and no money moves.
        </p>
      )}
      {/* Says what Ask and Withdraw did, for screen readers (DC-FR-14, DC-FR-15). */}
      <p role="status" className="sr-only">
        {actions.announcement}
      </p>
    </SeekProvider>
  );
}
