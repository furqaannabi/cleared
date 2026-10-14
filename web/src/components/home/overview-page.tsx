"use client";

import Link from "next/link";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { useDeals } from "@/components/shell/use-deals";
import { dealGroups } from "@/lib/home/deal-groups";
import { dueNext } from "@/lib/home/due-next";
import { moneyOverview } from "@/lib/home/money-overview";
import { figureTrends } from "@/lib/home/months";
import { performanceFigures } from "@/lib/home/performance";
import { DueNext } from "./due-next";
import { HomeDeals } from "./home-deals";
import { HowYoureDoing } from "./how-youre-doing";
import { MoneyCard } from "./money-card";
import { usePayments } from "./use-payments";


// The creator's own time zone, for the figures' months (HM-FR-13).
const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

const BUTTON = "inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover";

/**
 * The creator's overview at `/deals` (design A, the money card leads): the
 * money overview with "See payments", how they're doing, and their deals with
 * what needs them first. What was paid each month and the history are on
 * Payments. With no deals, it says so and offers Start a deal.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-01 to HM-FR-04, HM-FR-20, HM-FR-25; design/home/payments.html
 */
export function OverviewPage() {
  const deals = useDeals();
  const { load: money, retry } = usePayments();
  const rows = money.status === "ready" ? money.rows : [];
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 focus:outline-none md:px-6 md:pt-7 lg:px-9">
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">Overview</h1>
      {deals.status === "loading" && <PageSkeleton />}
      {deals.status === "error" && (
        <div role="alert" className="mx-auto max-w-md py-16 text-center">
          <p className="text-item-title font-bold">We couldn’t load your deals.</p>
          <p className="mt-2 text-ink-2">It may be your connection or a problem on our side.</p>
          <button type="button" onClick={() => window.location.reload()} className={`mt-5 ${BUTTON}`}>
            Try again
          </button>
        </div>
      )}
      {deals.status === "ready" && deals.deals.length === 0 && (
        <div className="mt-4 rounded-lg border border-line bg-surface px-5 py-10 text-center shadow-panel">
          <p className="font-head text-section-title font-bold">You have no deals yet.</p>
          <Link href="/deals/new" className={`mt-4 ${BUTTON}`}>
            Start a deal
          </Link>
        </div>
      )}
      {deals.status === "ready" && deals.deals.length > 0 && (
        <>
          {money.status === "loading" && <PageSkeleton />}
          {money.status === "error" && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-[18px] py-3 shadow-panel">
              <p className="font-bold">We couldn’t load your payments.</p>
              <button type="button" onClick={retry} className={BUTTON}>
                Try again
              </button>
            </div>
          )}
          {money.status === "ready" && (
            <>
              <MoneyCard overview={moneyOverview(rows)} />
              <DueNext {...dueNext(rows, new Date(), timeZone)} />
              <HowYoureDoing figures={performanceFigures(rows)} trends={figureTrends(rows, timeZone)} />
            </>
          )}
          <HomeDeals groups={dealGroups(deals.deals, rows)} />
        </>
      )}
    </main>
  );
}
