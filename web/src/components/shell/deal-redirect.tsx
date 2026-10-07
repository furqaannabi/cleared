"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { useDeals } from "./use-deals";

/**
 * `/deals/[dealId]`: opens the deliverable the API says needs the creator
 * (DC-FR-37). A deal that doesn't exist or isn't the creator's shows the same
 * plain not-found page (DC-FR-38).
 *
 * @param dealId - the deal's opaque id from the route
 */
export function DealRedirect({ dealId }: { dealId: string }) {
  const router = useRouter();
  const load = useDeals();
  const deal = load.status === "ready" ? load.deals.find((d) => d.id === dealId) : undefined;

  useEffect(() => {
    if (deal) router.replace(`/deals/${encodeURIComponent(deal.id)}/deliverables/${encodeURIComponent(deal.openDeliverableId)}`);
  }, [deal, router]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] focus:outline-none px-4 pt-4 md:px-6 lg:px-9">
      {load.status === "ready" && !deal && <LoadProblem error="not_found" onRetry={() => {}} />}
      {load.status === "error" && <LoadProblem error="unavailable" onRetry={() => window.location.reload()} />}
      {(load.status === "loading" || deal) && <PageSkeleton />}
    </main>
  );
}
