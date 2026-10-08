/** Date arithmetic for the money path. Pure: every function takes the moment it works from. */

/** PayPal guarantees held funds for 3 days and ends a hold after 29; day 28 leaves one day's margin. */
export const GUARANTEE_DAYS = 3;
export const LAST_DAY = 28;

export const hoursAfter = (from: Date, hours: number) => new Date(from.getTime() + hours * 3_600_000);

export const daysAfter = (from: Date, days: number) => hoursAfter(from, days * 24);

export const earliest = (...moments: Date[]) => new Date(Math.min(...moments.map((moment) => moment.getTime())));

export const latest = (...moments: Date[]) => new Date(Math.max(...moments.map((moment) => moment.getTime())));

/**
 * 23:59 in the creator's timezone, `days` calendar days after the day `from` falls on there
 * (docs/decisions/2026-10-06-deadline-shared-date-with-local-time.md).
 */
export function deadlineAfter(from: Date, days: number, timeZone: string): Date {
  const start = wallClock(from, timeZone);
  // The wall-clock time we want, written as if it were UTC. Date.UTC rolls the day over month ends.
  const wanted = Date.UTC(start.year, start.month - 1, start.day + days, 23, 59);
  // Correct by the zone's offset at that moment; the second pass settles a clock change in between.
  let moment = wanted;
  for (let pass = 0; pass < 2; pass++) {
    const shown = wallClock(new Date(moment), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    moment += wanted - shownAsUtc;
  }
  return new Date(moment);
}

/** What a clock on the wall reads in `timeZone` at `moment`. */
function wallClock(moment: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(moment);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}
