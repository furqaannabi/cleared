import type { PaymentRow } from "./payment-row";

/** The performance figures; a figure with nothing to count is absent (HM-FR-11). */
export interface PerformanceFigures {
  onTime?: string;
  passedFirstTime?: string;
  timeToPaid?: string;
}

const count = (n: number, m: number, one: string, many: string) => `${n} of ${m} ${m === 1 ? one : many}`;
const HOUR = 3600_000;

/** "20 hours" under two days, "2 days" from two, rounded to the nearest (HM-FR-10). */
export function duration(ms: number): string {
  if (ms < 48 * HOUR) {
    const h = Math.max(1, Math.round(ms / HOUR));
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  return `${Math.round(ms / (24 * HOUR))} days`;
}

/**
 * How well the creator runs deals, as counts, never percentages: posts live by
 * their deadline, drafts that passed their first check, and the mean time from
 * posting to paid.
 *
 * @param rows - every post that has had a hold
 * @see docs/specs/creator-home-frd.md HM-FR-08 to HM-FR-11
 */
export function performanceFigures(rows: PaymentRow[]): PerformanceFigures {
  const figures: PerformanceFigures = {};
  const live = rows.filter((r) => r.publishedAt);
  if (live.length) {
    const onTime = live.filter((r) => Date.parse(r.publishedAt!) <= Date.parse(r.deadline)).length;
    figures.onTime = count(onTime, live.length, "post", "posts");
  }
  const checked = rows.filter((r) => r.firstCheckPassed !== null);
  if (checked.length) figures.passedFirstTime = count(checked.filter((r) => r.firstCheckPassed).length, checked.length, "draft", "drafts");
  const paid = rows.filter((r) => r.stage === "paid" && r.publishedAt && r.paidAt);
  if (paid.length) {
    const total = paid.reduce((sum, r) => sum + (Date.parse(r.paidAt!) - Date.parse(r.publishedAt!)), 0);
    figures.timeToPaid = duration(total / paid.length);
  }
  return figures;
}
