"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { csvFileName, paymentsCsv, type HistoryRow } from "@/lib/home/history";
import { DownloadIcon } from "./icons";

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
        {field("Cleared’s fee", row.fee)}
        {field("Received", row.received, true)}
        {field("Payout reference", row.payoutReference)}
        {field("Hold reference", row.holdReference)}
      </dl>
    </article>
  );
}

/**
 * The payment history: one row per paid post, as AG Grid from `md:` and as
 * cards on phones, both from the same rows; "Download CSV" saves the whole
 * history whatever the grid is filtered to.
 *
 * @param rows - the history rows, newest first
 * @param timeZone - the creator's time zone, for the file's date
 * @see docs/specs/creator-home-frd.md HM-FR-16 to HM-FR-19
 */
export function PaymentHistory({ rows, timeZone }: { rows: HistoryRow[]; timeZone: string }) {
  const wide = useMediaQuery("(min-width: 768px)");
  return (
    <section aria-labelledby="home-history" className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="home-history" className="font-head text-section-title font-bold">
          Payment history
        </h2>
        <button
          type="button"
          onClick={() => download(rows, timeZone)}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso hover:bg-latte-wash"
        >
          <DownloadIcon />
          Download CSV
        </button>
      </div>
      {wide ? (
        <HistoryGrid rows={rows} />
      ) : (
        <div className="grid gap-2.5">
          {rows.map((r) => (
            <Card key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}
