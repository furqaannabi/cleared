"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { dealHref } from "./deal-href";
import { useDeals } from "./use-deals";

/**
 * `/deals`: opens the creator's first deal, at the deliverable that needs
 * them (signing in lands here). With no deals
 * it says so; if the deals can't load it offers Try again. No deal id is
 * written into the landing page.
 *
 * @see docs/specs/landing-frd.md LP-FR-15; docs/specs/creator-draft-check-frd.md DC-FR-37
 */
export function FirstDealRedirect() {
  const router = useRouter();
  const load = useDeals();
  const first = load.status === "ready" ? load.deals[0] : undefined;

  useEffect(() => {
    const href = first && dealHref(first);
    if (href) router.replace(href);
  }, [first, router]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 focus:outline-none md:px-6 lg:px-9">
      {load.status === "ready" && !first && (
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em]">You have no deals yet.</h1>
        </div>
      )}
      {load.status === "error" && (
        <div role="alert" className="mx-auto max-w-md py-16 text-center">
          <p className="text-item-title font-bold">We couldn’t load your deals.</p>
          <p className="mt-2 text-ink-2">It may be your connection or a problem on our side.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover"
          >
            Try again
          </button>
        </div>
      )}
      {(load.status === "loading" || first) && <PageSkeleton />}
    </main>
  );
}
