"use client";

import Link from "next/link";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { useDealDraft } from "@/components/checklist-builder/use-deal-draft";
import { stepLinks } from "@/lib/checklist-builder/step-links";
import { DealStepHeader } from "./deal-step-header";
import { NewDealForm } from "./new-deal-form";

/**
 * `/deals/[dealId]/posts`: the deal's brand and posts, editable until the
 * brief is sent (or after it couldn't be read); after that, says the posts
 * are set and links back to the checklist page.
 *
 * @param dealId - the deal
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-23
 */
export function PostsPage({ dealId }: { dealId: string }) {
  const { draft, error, reload } = useDealDraft(dealId);
  const editable = draft && (draft.reading === "idle" || draft.reading === "failed");
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 focus:outline-none md:px-6 lg:px-9">
      {error && <LoadProblem error={error === "not_found" ? "not_found" : "unavailable"} onRetry={reload} />}
      {!draft && !error && <PageSkeleton />}
      {draft && (
        <>
          <DealStepHeader brand={draft.brandName} dealId={draft.id} title="Posts" stage="posts" links={stepLinks(draft)} />
          <div className="mt-5 max-w-[520px] rounded-[20px] border border-line bg-surface px-[18px] py-[22px] shadow-panel md:px-[30px] md:py-7">
            {editable ? (
              <NewDealForm existing={draft} />
            ) : (
              <div className="grid gap-3">
                <p className="font-semibold">Posts are set once the brief is read.</p>
                <Link href={`/deals/${encodeURIComponent(draft.id)}/checklist`} className="inline-flex min-h-11 items-center font-bold text-espresso underline underline-offset-3">
                  Back to the checklist
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
