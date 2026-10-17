"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { dealHref } from "./deal-href";
import { useDeals } from "./use-deals";

/**
 * `/deals/[dealId]`: opens the deliverable the API says needs the creator
 * (DC-FR-37), or the checklist while the deal is at that step (BC-FR-03). A deal that doesn't exist or isn't the creator's shows the same
 * plain not-found page (DC-FR-38). A deal with nothing to open says so
 * rather than loading forever (DC-FR-57).
 *
 * @param dealId - the deal's opaque id from the route
 */
export function DealRedirect({ dealId }: { dealId: string }) {
  const router = useRouter();
  const load = useDeals();
  const deal = load.status === "ready" ? load.deals.find((d) => d.id === dealId) : undefined;
  const href = deal ? dealHref(deal) : null;

  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] focus:outline-none px-4 pt-4 md:px-6 lg:px-9">
      {load.status === "ready" && !deal && <LoadProblem error="not_found" onRetry={() => {}} />}
      {load.status === "error" && <LoadProblem error="unavailable" onRetry={() => window.location.reload()} />}
      {deal && !href && (
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em]">This deal has nothing to open.</h1>
          <Link href="/deals" className="mt-3 inline-flex min-h-11 items-center font-bold text-espresso underline underline-offset-2">
            Back to Deals
          </Link>
        </div>
      )}
      {(load.status === "loading" || href) && <PageSkeleton />}
    </main>
  );
}
