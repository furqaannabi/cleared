"use client";

import Link from "next/link";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { useDeals } from "@/components/shell/use-deals";
import { dealGroups } from "@/lib/home/deal-groups";
import { historyRows } from "@/lib/home/history";
import { moneyOverview } from "@/lib/home/money-overview";
import { figureTrends, paidEachMonth } from "@/lib/home/months";
import { performanceFigures } from "@/lib/home/performance";
import { HomeDeals } from "./home-deals";
import { HowYoureDoing } from "./how-youre-doing";
import { MoneyCard } from "./money-card";
import { PaymentHistory } from "./payment-history";
import { usePayments } from "./use-payments";

/** HM-FR-20: the money sections, off until Furqaan's `GET /me/payments` is in the contract. */
export const PAYMENTS = process.env.NEXT_PUBLIC_PAYMENTS === "enabled";

// The creator's own time zone, for months and dates (HM-FR-12).
const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

const BUTTON = "inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover";

/**
 * The creator's home at `/deals` (design A, the money card leads): the money
 * overview, how they're doing, their deals with what needs them first, and
 * the payment history. With no deals, it says so and offers Start a deal.
 *
 * @param payments - whether the money sections show (the build flag; tests)
 * @see docs/specs/creator-home-frd.md HM-FR-01 to HM-FR-04, HM-FR-20; design/home/option-a.html
 */
export function HomePage({ payments = PAYMENTS }: { payments?: boolean }) {
  const deals = useDeals();
  const { load: money, retry } = usePayments(payments);
  const rows = money.status === "ready" ? money.rows : [];
  const history = historyRows(rows, timeZone);
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 focus:outline-none md:px-6 md:pt-7 lg:px-9">
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">Home</h1>
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
              <HowYoureDoing
                figures={performanceFigures(rows)}
                trends={figureTrends(rows, timeZone)}
                months={rows.some((r) => r.stage === "paid") ? paidEachMonth(rows, new Date(), timeZone) : null}
              />
            </>
          )}
          <HomeDeals groups={dealGroups(deals.deals, rows)} />
          {history.length > 0 && <PaymentHistory rows={history} timeZone={timeZone} />}
        </>
      )}
    </main>
  );
}
