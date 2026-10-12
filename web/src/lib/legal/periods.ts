/**
 * How long Cleared keeps each kind of data, and how fast a deletion request
 * is done: Furqaan's answers (legal pages FRD, "Requests for Furqaan"). Null
 * until he answers; the pages stay unlinked behind the legal flag until every
 * one is filled (LG-FR-14).
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-08, LG-FR-13
 */
export const PERIODS: Record<"drafts" | "checks" | "payments" | "account" | "logs" | "deletion", string | null> = {
  drafts: null,
  checks: null,
  payments: null,
  account: null,
  logs: null,
  deletion: null,
};

/** A period's words, or a plain "not yet confirmed" while Furqaan's answer is outstanding. */
export const period = (key: keyof typeof PERIODS): string => PERIODS[key] ?? "not yet confirmed";

/** Whether every period is answered, so the pages can be linked. */
export const periodsComplete = (): boolean => Object.values(PERIODS).every((p) => p !== null);
