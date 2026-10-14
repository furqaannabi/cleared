import Link from "next/link";
import type { NotPaidRow } from "@/lib/home/not-paid";
import { ArrowIcon } from "./icons";

/** The line above the Not paid list. */
export const NOT_PAID_INTRO = "Posts whose hold went back to the brand, or was never collected.";

/**
 * The posts that were not paid: a plain list at every width, newest first,
 * each row with the date, the post, why, and the deal amount, linking to
 * the post. Never AG Grid, never in the CSV.
 *
 * @param rows - from `notPaid`
 * @see docs/specs/creator-home-frd.md HM-FR-29, HM-FR-30 (1.8)
 */
export function NotPaidList({ rows }: { rows: NotPaidRow[] }) {
  return (
    <ul className="rounded-lg border border-line bg-surface px-[18px] py-1 shadow-panel md:px-[26px]">
      {rows.map((r) => (
        <li key={r.id} className="border-line-soft not-first:border-t">
          <Link
            href={r.href}
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_18px] items-center gap-x-3 gap-y-0.5 py-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.4fr)_110px_18px]"
          >
            <span className="min-w-0 text-[14.5px] md:col-start-2 md:row-start-1">
              <b className="font-extrabold">{r.brand}</b> · {r.post}
            </span>
            <span className="col-start-1 text-[14px] text-ink-2 md:col-start-3 md:row-start-1">{r.why}</span>
            <span className="col-start-1 text-[13px] text-ink-3 md:row-start-1">{r.date}</span>
            <span className="col-start-2 row-start-1 text-right text-[14px] whitespace-nowrap text-ink-3 tabular-nums md:col-start-4">{r.amount}</span>
            <span className="col-start-3 row-span-3 row-start-1 text-ink-3 md:col-start-5 md:row-span-1">
              <ArrowIcon className="size-4" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
