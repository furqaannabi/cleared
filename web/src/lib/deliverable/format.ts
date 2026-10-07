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

/** "18:59", 24-hour, in the given timezone (the viewer's when omitted). */
export function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(
    new Date(iso),
  );
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function formatAgo(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
