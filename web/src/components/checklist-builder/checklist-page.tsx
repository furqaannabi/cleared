"use client";

import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { BriefForm } from "@/components/brief/brief-form";
import { DealStepHeader } from "@/components/new-deal/deal-step-header";
import { useRefreshDeals } from "@/components/shell/use-deals";
import { stepLinks } from "@/lib/checklist-builder/step-links";
import type { DealDraft } from "@/lib/checklist-builder/types";
import { ReadingView } from "@/components/brief/reading-view";
import { ChecklistBuilder } from "./checklist-builder";
import { useDealDraft } from "./use-deal-draft";

/**
 * `/deals/[dealId]/checklist`: the brief and the checklist for a deal at step 1.
 * Paste the brief, watch it being read, then build the checklist (BC FRD).
 *
 * @param dealId - the deal
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-03 to BC-FR-18
 */
export function ChecklistPage({ dealId }: { dealId: string }) {
  const { draft, error, replace: setDraft, reload } = useDealDraft(dealId);
  const refreshDeals = useRefreshDeals();
  // BC-FR-17: the rail follows the deal's step.
  const replace = (next: DealDraft) => {
    if (draft && next.step !== draft.step) refreshDeals();
    setDraft(next);
  };
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-36 focus:outline-none md:px-6 md:pb-16 lg:px-9">
      {error && <LoadProblem error={error === "not_found" ? "not_found" : "unavailable"} onRetry={reload} />}
      {!draft && !error && <PageSkeleton />}
      {draft && (
        <>
          <DealStepHeader
            brand={draft.brandName}
            dealId={draft.id}
            links={stepLinks(draft)}
            title={draft.reading === "done" ? "Checklist" : "Brief"}
            stage={draft.ready ? "invite" : draft.reading === "done" ? "checklist" : "brief"}
          />
          {draft.reading !== "idle" && draft.reading !== "failed" && <p className="mt-2 text-meta text-ink-3">Posts are set once the brief is read.</p>}
          <div id="brief" className="mt-6 scroll-mt-6">
            {draft.reading === "idle" && <BriefForm draft={draft} onSent={replace} />}
            {draft.reading === "reading" && <ReadingView draft={draft} />}
            {draft.reading === "failed" && (
              <div className="grid max-w-3xl gap-4">
                <p role="alert" className="font-bold">
                  We couldn’t read this brief.
                </p>
                <BriefForm draft={draft} onSent={replace} initial={(draft.brief?.lines ?? []).map((l) => l.text).join("\n")} />
              </div>
            )}
            {draft.reading === "done" && <ChecklistBuilder draft={draft} onChange={replace} />}
          </div>
        </>
      )}
    </main>
  );
}
