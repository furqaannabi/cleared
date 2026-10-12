import { formatMoney } from "@/lib/deliverable/format";
import type { PaymentRow } from "./payment-row";
import { postHref, postWord } from "./post-words";

/** One paid post in the payment history, ready to show and to export. */
export interface HistoryRow {
  id: string;
  href: string;
  /** "9 Oct 2026", in the creator's time zone. */
  date: string;
  /** "2026-10-09", for the CSV. */
  isoDate: string;
  paidAtMs: number;
  brand: string;
  post: string;
  amount: string;
  fee: string;
  received: string;
  amountMinor: number;
  feeMinor: number;
  receivedMinor: number;
  payoutReference: string;
  holdReference: string;
}

/** "2026-10-09" in the time zone. */
function isoDay(at: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

/**
 * The payment history: one row per paid post, newest first, with the API's
 * amounts, fee and what was received, and both PayPal references.
 *
 * @param rows - every post that has had a hold
 * @param timeZone - the creator's time zone, for the date paid
 * @see docs/specs/creator-home-frd.md HM-FR-16
 */
export function historyRows(rows: PaymentRow[], timeZone: string): HistoryRow[] {
  return rows
    .filter((r) => r.stage === "paid" && r.paidAt)
    .map((r) => ({
      id: r.deliverableId,
      href: postHref(r),
      date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(r.paidAt!)),
      isoDate: isoDay(r.paidAt!, timeZone),
      paidAtMs: Date.parse(r.paidAt!),
      brand: r.brandName,
      post: postWord(r.platform),
      amount: formatMoney(r.amountMinor, r.currency),
      fee: formatMoney(r.feeMinor, r.currency),
      received: formatMoney(r.receivedMinor, r.currency),
      amountMinor: r.amountMinor,
      feeMinor: r.feeMinor,
      receivedMinor: r.receivedMinor,
      payoutReference: r.payout?.reference ?? "",
      holdReference: r.holdReference,
    }))
    .sort((a, b) => b.paidAtMs - a.paidAtMs);
}

/** "1140.00" from cents, without floats. */
const decimal = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;

/** A cell that can't run as a formula and survives commas, quotes and line breaks (RFC 4180). */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const HEADER = ["Date paid", "Brand", "Post", "Deal amount", "Fee", "Received", "Payout reference", "Hold reference"];

/**
 * The payment history as CSV text: the whole history, amounts as plain
 * decimals, dates as YYYY-MM-DD, every cell escaped. Brand names are typed by
 * people and treated as untrusted.
 *
 * @param rows - the history rows (all of them, whatever the grid is filtered to)
 * @see docs/specs/creator-home-frd.md HM-FR-19, HM-BR-04
 */
export function paymentsCsv(rows: HistoryRow[]): string {
  const lines = [HEADER, ...rows.map((r) => [r.isoDate, r.brand, r.post, decimal(r.amountMinor), decimal(r.feeMinor), decimal(r.receivedMinor), r.payoutReference, r.holdReference])];
  return lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** "cleared-payments-2026-10-12.csv", today in the creator's time zone (HM-FR-19). */
export function csvFileName(now: Date, timeZone: string): string {
  return `cleared-payments-${isoDay(now, timeZone)}.csv`;
}
