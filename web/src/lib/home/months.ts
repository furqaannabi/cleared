import { formatMoney } from "@/lib/deliverable/format";
import type { PaymentRow } from "./payment-row";
import { duration } from "./performance";

/** One month's bar: what was received that month. */
export interface MonthPaid {
  label: string;
  amountMinor: number;
  text: string;
  current: boolean;
  /** The text equivalent screen readers get (HM-FR-14). */
  spoken: string;
}

/** One point on a figure's trend line. */
export interface TrendPoint {
  month: string;
  value: number;
  spoken: string;
}

/** A year and month in the creator's time zone, as a sortable key ("2026-09"). */
function monthKey(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}`;
}

const monthName = (key: string, month: "short" | "long") =>
  new Intl.DateTimeFormat("en-US", { month, timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`));

function lastSixMonths(now: Date, timeZone: string): string[] {
  const [y, m] = monthKey(now, timeZone).split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * What the creator received in each of the last six months, by the payout's
 * paid date in their time zone; the current month is marked "so far".
 *
 * @param rows - every post that has had a hold
 * @param now - today
 * @param timeZone - the creator's time zone
 * @see docs/specs/creator-home-frd.md HM-FR-12, HM-FR-14
 */
export function paidEachMonth(rows: PaymentRow[], now: Date, timeZone: string): MonthPaid[] {
  const months = lastSixMonths(now, timeZone);
  return months.map((key, i) => {
    const amountMinor = rows
      .filter((r) => r.stage === "paid" && r.paidAt && monthKey(r.paidAt, timeZone) === key)
      .reduce((sum, r) => sum + r.receivedMinor, 0);
    const current = i === months.length - 1;
    const text = formatMoney(amountMinor, "USD");
    return { label: monthName(key, "short"), amountMinor, text, current, spoken: `${monthName(key, "long")}${current ? " so far" : ""}: ${text}` };
  });
}

/** Points by month for one figure, or undefined with fewer than three months to count (HM-FR-13). */
function trend(groups: Map<string, PaymentRow[]>, point: (rows: PaymentRow[]) => { value: number; text: string }): TrendPoint[] | undefined {
  if (groups.size < 3) return undefined;
  return [...groups.keys()].sort().map((key) => {
    const { value, text } = point(groups.get(key)!);
    return { month: monthName(key, "short"), value, spoken: `${monthName(key, "long")} ${text}` };
  });
}

function byMonth(rows: PaymentRow[], date: (r: PaymentRow) => string | undefined, timeZone: string): Map<string, PaymentRow[]> {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    const at = date(r);
    if (!at) continue;
    const key = monthKey(at, timeZone);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return groups;
}

/**
 * Each performance figure by month, for its trend line: on time by the month
 * a post went live, passed first time by the month it was held, time to paid
 * by the month it was paid. A figure with fewer than three months is absent.
 *
 * @param rows - every post that has had a hold
 * @param timeZone - the creator's time zone
 * @see docs/specs/creator-home-frd.md HM-FR-13, HM-FR-14
 */
export function figureTrends(rows: PaymentRow[], timeZone: string): { onTime?: TrendPoint[]; passedFirstTime?: TrendPoint[]; timeToPaid?: TrendPoint[] } {
  const ratio = (rs: PaymentRow[], pass: (r: PaymentRow) => boolean) => {
    const n = rs.filter(pass).length;
    return { value: n / rs.length, text: `${n} of ${rs.length}` };
  };
  return {
    onTime: trend(byMonth(rows, (r) => r.publishedAt, timeZone), (rs) => ratio(rs, (r) => Date.parse(r.publishedAt!) <= Date.parse(r.deadline))),
    passedFirstTime: trend(
      byMonth(rows.filter((r) => r.firstCheckPassed !== null), (r) => r.heldAt, timeZone),
      (rs) => ratio(rs, (r) => r.firstCheckPassed === true),
    ),
    timeToPaid: trend(
      byMonth(rows.filter((r) => r.stage === "paid" && r.publishedAt), (r) => r.paidAt, timeZone),
      (rs) => {
        const ms = rs.reduce((s, r) => s + (Date.parse(r.paidAt!) - Date.parse(r.publishedAt!)), 0) / rs.length;
        return { value: ms / 86_400_000, text: duration(ms) };
      },
    ),
  };
}
