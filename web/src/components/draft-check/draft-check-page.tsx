"use client";

import { useMemo, useState } from "react";
import { ChecklistFilter } from "@/components/checklist/checklist-filter";
import { ChecklistItems } from "@/components/checklist/checklist-items";
import { tabsFor, type ChecklistTab } from "@/lib/checklist/item-status";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { MoneyCard } from "@/components/money/money-card";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import type { Deliverable } from "@/lib/deliverable/types";
import { LoadProblem } from "./load-problem";
import { PageSkeleton } from "./page-skeleton";
import { useDeliverable } from "./use-deliverable";

/**
 * The creator's draft check page for one deliverable: loads it and shows
 * the loading, not-found, error and loaded states.
 *
 * @param deliverableId - the deliverable's opaque id from the route
 * @see docs/specs/creator-draft-check-frd.md DC-FR-01, DC-FR-38, DC-FR-39
 */
export function DraftCheckPage({ deliverableId }: { deliverableId: string }) {
  const { load, retry } = useDeliverable(deliverableId);
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-36 md:px-6 lg:px-9">
      {load.status === "loading" && <PageSkeleton />}
      {load.status === "ready" && <Loaded deliverable={load.deliverable} />}
      {load.status === "error" && <LoadProblem error={load.error} onRetry={retry} />}
    </main>
  );
}

function Loaded({ deliverable }: { deliverable: Deliverable }) {
  // Recomputed per load; `now` is read once so the page doesn't shift while open.
  const view = useMemo(() => deliverableView(deliverable, new Date()), [deliverable]);
  const [selectedId, setSelectedId] = useState<string | null>(view.defaultItemId);
  const [filter, setFilter] = useState<ChecklistTab>("all");
  const shown = view.items.filter((i) => tabsFor(i.status).includes(filter));
  const wide = useMediaQuery("(min-width: 768px)");
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  return (
    <>
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{view.title}</h1>
      {/*
        DESIGN.md layout. Phone and tablet: one column (money, next step, evidence).
        Desktop: next step (and the player, when built) on the left; money above
        the evidence panel on the right; the checklist full width below.
      */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
        <div className="lg:col-start-2 lg:row-start-1">
          <MoneyCard deliverable={deliverable} />
        </div>
        <section
          aria-label="What to do next"
          className="rounded-lg bg-latte-wash px-5 py-4 text-ink-2 lg:col-start-1 lg:row-start-1"
        >
          <p>
            <b className="text-ink">{view.nextStep.lead}</b> {view.nextStep.detail}
          </p>
        </section>
        {/* DC-FR-12: tablet and up only; on phones the expanded card shows the evidence. */}
        {wide && (
          <div className="lg:col-start-2 lg:row-start-2">
            <EvidencePanel item={selected} brandName={deliverable.brandName} />
          </div>
        )}
      </div>
      <section aria-label="Checklist" className="mt-8">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-head text-section-title font-bold">
            Checklist<small className="ml-1.5 font-sans text-[14px] font-semibold text-ink-3">{view.items.length} items</small>
          </h2>
          {view.tabs.length > 0 && <ChecklistFilter tabs={view.tabs} value={filter} onChange={setFilter} />}
        </div>
        <div className="mt-3.5">
          {shown.length > 0 ? (
            <ChecklistItems items={shown} brandName={deliverable.brandName} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <p className="rounded-lg border border-dashed border-line p-7 text-center text-ink-3">Nothing here right now.</p>
          )}
        </div>
      </section>
    </>
  );
}
