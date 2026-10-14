import Link from "next/link";
import type { DueRow } from "@/lib/home/due-next";
import { ArrowIcon } from "./icons";

/**
 * "What's due next" on Overview: the held posts not yet posted, soonest
 * deadline first, each with what the creator will receive and a link to the
 * post. Renders nothing when there are none.
 *
 * @param rows - at most three posts, from `dueNext`
 * @param more - how many more are due after them
 * @see docs/specs/creator-home-frd.md HM-FR-27 (1.8)
 */
export function DueNext({ rows, more }: { rows: DueRow[]; more: number }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="home-due" className="mt-5 rounded-lg border border-line bg-surface px-[18px] pt-4 pb-2.5 shadow-panel lg:px-[26px] lg:pt-5 lg:pb-3">
      <h2 id="home-due" className="font-head text-[19px] font-bold">
        What’s due next
      </h2>
      <p className="mt-0.5 mb-1 text-[13.5px] text-ink-3">Held for you, not yet posted. What you’ll receive.</p>
      <ul>
        {rows.map((r) => (
          <li key={r.href} className="border-line-soft not-first:border-t">
            <Link
              href={r.href}
              className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_18px] items-center gap-x-3 gap-y-0.5 py-2 md:grid-cols-[minmax(0,1fr)_170px_110px_18px]"
            >
              <span className="min-w-0 text-[14px] text-ink-2">
                <b className="font-bold text-ink">{r.brand}</b> · {r.post}
              </span>
              <span className={`col-start-1 text-[13.5px] md:col-start-2 md:row-start-1 ${r.soon ? "font-bold text-ink" : "text-ink-3"}`}>{r.due}</span>
              <span className="col-start-2 row-span-2 row-start-1 text-right text-[14px] font-extrabold tabular-nums md:col-start-3 md:row-span-1">{r.amount}</span>
              <span className="col-start-3 row-span-2 row-start-1 text-ink-3 md:col-start-4 md:row-span-1">
                <ArrowIcon className="size-4" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="pt-1.5 pb-0.5 text-[13.5px] text-ink-3">and {more} more</p>}
    </section>
  );
}
