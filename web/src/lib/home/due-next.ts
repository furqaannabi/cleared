import { formatMoney } from "@/lib/deliverable/format";
import type { PaymentRow } from "./payment-row";
import { postHref, postWord } from "./post-words";

/** One post in "What's due next": what it is, when it's due, and what the creator will receive. */
export interface DueRow {
  brand: string;
  post: string;
  due: string;
  /** Due today or tomorrow: shown in bold, never by colour alone. */
  soon: boolean;
  amount: string;
  href: string;
}

const SHOWN = 3;

/** "2026-10-23": the day a moment falls on in the given time zone. */
const dayKey = (at: Date | string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date(at));

/** Whole days from one day key to another. */
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * "What's due next" on Overview: the held posts not yet published, soonest
 * deadline first, at most three, and how many more. The deadline is read on
 * the creator's own days ("Due today", "Due tomorrow", "Due Fri 23 Oct").
 *
 * @param rows - every post that has had a hold
 * @param now - the current moment
 * @param timeZone - the creator's time zone
 * @see docs/specs/creator-home-frd.md HM-FR-27 (1.8)
 */
export function dueNext(rows: PaymentRow[], now: Date, timeZone: string): { rows: DueRow[]; more: number } {
  const today = dayKey(now, timeZone);
  const due = rows.filter((r) => r.stage === "held" && !r.publishedAt).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const shown = due.slice(0, SHOWN).map((r): DueRow => {
    const away = daysBetween(today, dayKey(r.deadline, timeZone));
    const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(r.deadline));
    return {
      brand: r.brandName,
      post: postWord(r.platform),
      due: away <= 0 ? "Due today" : away === 1 ? "Due tomorrow" : `Due ${day.replace(",", "")}`,
      soon: away <= 1,
      amount: formatMoney(r.receivedMinor ?? r.amountMinor, "USD"),
      href: postHref(r),
    };
  });
  return { rows: shown, more: Math.max(0, due.length - SHOWN) };
}
