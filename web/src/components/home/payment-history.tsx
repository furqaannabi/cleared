"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { csvFileName, paymentsCsv, type HistoryRow } from "@/lib/home/history";
import type { NotPaidRow } from "@/lib/home/not-paid";
import { DownloadIcon } from "./icons";
import { NOT_PAID_INTRO, NotPaidList } from "./not-paid-list";

// AG Grid only loads from md: up (HM-FR-17).
const HistoryGrid = dynamic(() => import("./history-grid"), { ssr: false });

/** Saves the whole history as a CSV file, built in the browser (HM-FR-19). */
function download(rows: HistoryRow[], timeZone: string) {
  const url = URL.createObjectURL(new Blob([paymentsCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFileName(new Date(), timeZone);
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ row }: { row: HistoryRow }) {
  const field = (label: string, value: string, strong = false) => (
    <>
      <dt className={strong ? "font-bold text-ink" : "text-ink-3"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-extrabold" : ""}`}>{value}</dd>
    </>
  );
  return (
    <article className="rounded-md border border-line bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <Link href={row.href} className="font-bold underline-offset-3 hover:underline">
          {row.brand} · {row.post}
        </Link>
        <span className="flex-none text-[13.5px] text-ink-3">{row.date}</span>
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13.5px]">
        {field("Deal amount", row.amount)}
        {field("Sponing’s fee", row.fee)}
        {field("Received", row.received, true)}
        {field("Payout reference", row.payoutReference)}
        {field("Hold reference", row.holdReference)}
      </dl>
    </article>
  );
}

type Tab = "paid" | "not_paid";
const TABS: { id: Tab; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "not_paid", label: "Not paid" },
];

/**
 * The payment history: one row per paid post, as AG Grid from `md:` and as
 * cards on phones, both from the same rows; "Download CSV" saves the whole
 * history whatever the grid is filtered to. When any post was not paid, two
 * tabs, Paid and Not paid; Download CSV shows on Paid only.
 *
 * @param rows - the history rows, newest first
 * @param notPaid - the posts not paid, newest first; no tabs when empty
 * @param timeZone - the creator's time zone, for the file's date
 * @see docs/specs/creator-home-frd.md HM-FR-16 to HM-FR-19, HM-FR-28 to HM-FR-30 (1.8)
 */
export function PaymentHistory({ rows, notPaid = [], timeZone }: { rows: HistoryRow[]; notPaid?: NotPaidRow[]; timeZone: string }) {
  const wide = useMediaQuery("(min-width: 768px)");
  const [tab, setTab] = useState<Tab>("paid");
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ paid: null, not_paid: null });
  const tabbed = notPaid.length > 0;
  const shown: Tab = tabbed ? tab : "paid";
  const count: Record<Tab, number> = { paid: rows.length, not_paid: notPaid.length };

  // Left and right move between the two tabs, selecting as they go.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Tab = shown === "paid" ? "not_paid" : "paid";
    setTab(next);
    refs.current[next]?.focus();
  };

  const paid = wide ? (
    <HistoryGrid rows={rows} />
  ) : (
    <div className="grid gap-2.5">
      {rows.map((r) => (
        <Card key={r.id} row={r} />
      ))}
    </div>
  );
  return (
    <section aria-labelledby="pay-history" className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="pay-history" className="font-head text-section-title font-bold">
          Payment history
        </h2>
        {shown === "paid" && (
          <button
            type="button"
            onClick={() => download(rows, timeZone)}
            className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso hover:bg-latte-wash"
          >
            <DownloadIcon />
            Download CSV
          </button>
        )}
      </div>
      {!tabbed ? (
        paid
      ) : (
        <>
          {/* HM-FR-28 (1.8): the checklist builder's pill tabs, 44 px tall. */}
          <div role="tablist" aria-label="Payment history" onKeyDown={onKey} className="mb-3 flex w-max max-w-full gap-1.5 rounded-pill border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`pay-tab-${t.id}`}
                aria-selected={shown === t.id}
                aria-controls={`pay-panel-${t.id}`}
                tabIndex={shown === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-4 text-[14px] font-bold whitespace-nowrap text-ink-2 aria-selected:bg-espresso aria-selected:text-surface"
              >
                {t.label} <small className="text-xs font-semibold opacity-75">{count[t.id]}</small>
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`pay-panel-${shown}`} aria-labelledby={`pay-tab-${shown}`}>
            {shown === "paid" ? (
              paid
            ) : (
              <>
                <p className="mb-2.5 text-[13.5px] text-ink-3">{NOT_PAID_INTRO}</p>
                <NotPaidList rows={notPaid} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
