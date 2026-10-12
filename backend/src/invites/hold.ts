/**
 * A post's hold as both sides' pages show it (deal set-up spec DS-FR-44, DS-FR-46). It is read from
 * the money path and decided nowhere else: a page shows "held" only when the money path says so.
 */
import type { HoldView } from "../money/view";

export interface DealHold {
  state: HoldView["state"];
  /** Why a declined hold was declined (AH-FR-02). */
  reason?: "paypal_declined" | "timed_out";
  /** Why a post was closed without a hold (AH-FR-01). */
  because?: "never_held" | "cancelled";
  /** PayPal's reference for the hold, once held. */
  reference?: string;
  /** The date the creator must post by, as it reads in the creator's timezone: one date for both sides. */
  deadline?: string;
}

/** The calendar date, as YYYY-MM-DD, that a moment falls on in a timezone. */
export function dateIn(moment: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(moment);
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** A post with no money opened yet has no hold started: nothing can be held before the brand agrees (DS-BR-10). */
export function holdOf(hold: HoldView | undefined, timeZone: string | null): DealHold {
  if (!hold) return { state: "not_started" };
  if (hold.state === "declined") return { state: "declined", reason: hold.reason };
  if (hold.state === "not_held") return { state: "not_held", because: hold.because };
  if (hold.state !== "held") return { state: hold.state };
  return { state: "held", reference: hold.reference, ...(timeZone ? { deadline: dateIn(hold.deadlineAt, timeZone) } : {}) };
}
