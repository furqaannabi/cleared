"use client";

import Link from "next/link";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { historyRows } from "@/lib/home/history";
import { moneyOverview } from "@/lib/home/money-overview";
import { paidEachMonth, yearReceived } from "@/lib/home/months";
import { notPaid } from "@/lib/home/not-paid";
import type { PaymentRow } from "@/lib/home/payment-row";
import { NOT_PAID_INTRO, NotPaidList } from "./not-paid-list";
import { PaidEachMonth } from "./paid-each-month";
import { PaymentHistory } from "./payment-history";
import { usePayments } from "./use-payments";

// The creator's own time zone, for months, the year and dates (HM-FR-12, HM-FR-24).
const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

const BUTTON = "inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover";

/** HM-FR-26: before anything is paid, what will show here, and what is held or on its way. */
function NothingPaid({ rows }: { rows: PaymentRow[] }) {
  const o = moneyOverview(rows);
  const parts = [
    rows.some((r) => r.stage === "held") && `${o.held.text} is held for you`,
    rows.some((r) => r.stage === "captured") && `${o.onItsWay.text} is on its way`,
  ].filter(Boolean);
  return (
    <div className="mt-4 rounded-lg border border-line bg-surface px-5 py-7 shadow-panel">
      <p className="font-head text-[19px] font-bold">Nothing paid yet.</p>
      <p className="mt-2 text-[13.5px] text-ink-3">Each post you’re paid for shows here with its PayPal references, ready to download.</p>
      {parts.length > 0 && (
        <p className="mt-2">
          {parts.join(" and ")}.{" "}
          <Link href="/deals" className="font-bold text-espresso underline underline-offset-3">
            See your overview
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * Payments at `/payments`: the line for the year, "Paid each month", and the
 * payment history with Download CSV, and (1.8) the posts not paid under a
 * second tab; before anything is paid, a line saying so and the posts not paid.
 *
 * @see docs/specs/creator-home-frd.md HM-FR-12, HM-FR-16 to HM-FR-19, HM-FR-23, HM-FR-24, HM-FR-26, HM-FR-28 to HM-FR-30; design/home/payments.html (option 2), design/home/money-additions.html
 */
export function PaymentsPage() {
  const { load, retry } = usePayments();
  const rows = load.status === "ready" ? load.rows : [];
  const history = historyRows(rows, timeZone);
  const year = yearReceived(rows, new Date(), timeZone);
  const unpaid = notPaid(rows, timeZone);
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 focus:outline-none md:px-6 md:pt-7 lg:px-9">
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">Payments</h1>
      {load.status === "loading" && <PageSkeleton />}
      {load.status === "error" && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-[18px] py-3 shadow-panel">
          <p className="font-bold">We couldn’t load your payments.</p>
          <button type="button" onClick={retry} className={BUTTON}>
            Try again
          </button>
        </div>
      )}
      {load.status === "ready" && (
        <>
          {year && (
            <>
              <p className="mt-1.5 text-[15px] text-ink-2 md:text-body">
                <b className="font-extrabold text-ink">{year.total}</b>
                {year.rest}
              </p>
              {/* HM-FR-24 (1.8) */}
              <p className="mt-0.5 text-[13.5px] text-ink-3">{year.beforeFees}</p>
            </>
          )}
          {history.length === 0 ? (
            <>
              <NothingPaid rows={rows} />
              {/* HM-FR-26 (1.8): with nothing paid, the Not paid list under its own heading, no tabs. */}
              {unpaid.length > 0 && (
                <section aria-labelledby="pay-not-paid" className="mt-7">
                  <h2 id="pay-not-paid" className="font-head text-section-title font-bold">
                    Not paid
                  </h2>
                  <p className="mt-0.5 mb-2.5 text-[13.5px] text-ink-3">{NOT_PAID_INTRO}</p>
                  <NotPaidList rows={unpaid} />
                </section>
              )}
            </>
          ) : (
            <>
              <PaidEachMonth months={paidEachMonth(rows, new Date(), timeZone)} />
              <PaymentHistory rows={history} notPaid={unpaid} timeZone={timeZone} />
            </>
          )}
        </>
      )}
    </main>
  );
}
