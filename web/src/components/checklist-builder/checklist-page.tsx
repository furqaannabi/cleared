"use client";

import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { BriefForm } from "@/components/brief/brief-form";
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
  const { draft, error, replace, reload } = useDealDraft(dealId);
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-36 focus:outline-none md:px-6 md:pb-16 lg:px-9">
      {error && <LoadProblem error={error === "not_found" ? "not_found" : "unavailable"} onRetry={reload} />}
      {!draft && !error && <PageSkeleton />}
      {draft && (
        <>
          <Header brand={draft.brandName} stage={draft.ready ? "invite" : draft.reading === "done" ? "checklist" : "brief"} />
          <div className="mt-6">
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

const STAGES = [
  { id: "posts", label: "Posts" },
  { id: "brief", label: "Brief" },
  { id: "checklist", label: "Checklist" },
  { id: "invite", label: "Invite" },
] as const;

function Header({ brand, stage }: { brand: string; stage: "brief" | "checklist" | "invite" }) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <header>
      <p className="text-meta text-ink-3">Deals › {brand}</p>
      <h1 className="mt-1.5 font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">
        {brand} · {stage === "brief" ? "Brief" : "Checklist"}
      </h1>
      <ol aria-label="New deal steps" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
        {STAGES.map((s, i) => (
          <li key={s.id} aria-current={i === at ? "step" : undefined} className={`flex items-center gap-2 ${i < at ? "text-espresso" : i === at ? "text-ink" : "text-ink-4"}`}>
            {i > 0 && <span aria-hidden="true" className="text-ink-4">·</span>}
            {s.label}
            {i < at && <span className="sr-only">(done)</span>}
          </li>
        ))}
      </ol>
    </header>
  );
}
