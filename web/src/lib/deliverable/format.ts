/** "24 Oct", in the given timezone (the viewer's when omitted). */
export function formatDay(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(new Date(iso));
}

/** "Fri 9 Oct, 14:00", in the given timezone (the viewer's when omitted). */
export function formatDayTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

/** "1 item" / "3 items". */
export function itemCount(n: number): string {
  return `${n} ${n === 1 ? "item" : "items"}`;
}

/** "$1,200.00" from integer minor units. */
export function formatMoney(amountMinor: number, currency: string): string {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(amountMinor / 10 ** digits);
}

/** "14:20" from seconds. */
export function formatDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
