/** A typed amount, checked: a two-place US-dollar decimal string, or why it isn't one. */
export type ParsedAmount = { ok: true; value: string } | { ok: false; message: string };

/**
 * Reads what the creator typed as a US-dollar amount. Works on the text
 * alone, never through a float (IN-BR-02).
 *
 * @param text - the field's text, e.g. "1,200" or "$450.50"
 * @returns the amount as a two-place decimal string ("1200.00"), or a message
 * @see docs/specs/creator-invite-frd.md IN-FR-05 (1.3)
 */
export function parseAmount(text: string): ParsedAmount {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!cleaned) return { ok: false, message: "Add an amount" };
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return { ok: false, message: "Enter an amount in dollars, like 1200 or 1200.50" };
  const whole = match[1].replace(/^0+(?=\d)/, "");
  const value = `${whole}.${(match[2] ?? "").padEnd(2, "0")}`;
  // Very long digit runs are over the limit without reading them as a number.
  if (whole.length > 7) return { ok: false, message: AMOUNT_TOO_HIGH };
  const cents = toCents(value);
  if (cents < MIN_CENTS) return { ok: false, message: AMOUNT_TOO_LOW };
  if (cents > MAX_CENTS) return { ok: false, message: AMOUNT_TOO_HIGH };
  return { ok: true, value };
}

// IN-FR-05 (1.3): one hold is $20.00 to $10,000.00 (docs/decisions/2026-10-08-cleared-fee-and-amount-limits.md).
const MIN_CENTS = 2_000;
const MAX_CENTS = 1_000_000;
/** IN-FR-05, IN-FR-06: under the least one post can be, typed or refused by the API. */
export const AMOUNT_TOO_LOW = "The least one post can be is $20.00.";
/** IN-FR-05, IN-FR-06: over the most one post can be, typed or refused by the API. */
export const AMOUNT_TOO_HIGH = "The most one post can be is $10,000.00.";

/**
 * IN-FR-06 (1.3): the words for an amount the API refused, from the
 * contract's code, or null when the refusal isn't about the amount's limits.
 *
 * @param code - the refusal's code, e.g. "amount_above_maximum"
 */
export function amountRefusal(code: string | undefined): string | null {
  if (code === "amount_below_minimum") return AMOUNT_TOO_LOW;
  if (code === "amount_above_maximum") return AMOUNT_TOO_HIGH;
  return null;
}

/** A two-place decimal string as whole cents (an integer, so no float rounding). */
function toCents(value: string): number {
  const [whole, frac] = value.split(".");
  return Number(whole) * 100 + Number(frac);
}

/**
 * A two-place decimal string as the creator reads it: "$1,200.00".
 *
 * @param value - e.g. "1200.00"
 * @see docs/specs/creator-invite-frd.md IN-FR-08
 */
export function formatAmount(value: string): string {
  const [whole, frac] = value.split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

/**
 * The total of several two-place decimal strings, added in whole cents.
 *
 * @param values - e.g. ["1200.00", "450.00"]
 * @returns e.g. "1650.00"
 * @see docs/specs/creator-invite-frd.md IN-FR-08, IN-BR-02
 */
export function sumAmounts(values: string[]): string {
  const cents = values.reduce((sum, v) => sum + toCents(v), 0);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
