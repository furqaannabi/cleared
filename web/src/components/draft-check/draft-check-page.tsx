"use client";

import { useMemo } from "react";
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
  return (
    <>
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{view.title}</h1>
      <section aria-label="What to do next" className="mt-5 rounded-lg bg-latte-wash px-5 py-4 text-ink-2">
        <p>
          <b className="text-ink">{view.nextStep.lead}</b> {view.nextStep.detail}
        </p>
      </section>
    </>
  );
}
