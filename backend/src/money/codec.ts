/**
 * Writes a money state as the document kept in Postgres, and reads it back
 * (docs/decisions/2026-10-08-money-state-as-one-document.md).
 *
 * JSON has no dates, so each one is written in a marked form and turned back into a date on reading.
 * A state comes back exactly as it went in.
 */
import type { Prisma } from "../generated/prisma/client";
import type { MoneyState } from "./types";

const DATE = "$date";

function encode(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { [DATE]: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, inner] of Object.entries(value)) {
      // An optional field that is not set is left out, as it would be in the state itself.
      if (inner !== undefined) out[key] = encode(inner);
    }
    return out;
  }
  return value as string | number | boolean;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value !== "object" || value === null) return value;
  const marked = (value as Record<string, unknown>)[DATE];
  if (typeof marked === "string" && Object.keys(value).length === 1) return new Date(marked);
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, decode(inner)]));
}

export function encodeState(state: MoneyState): Prisma.InputJsonObject {
  return encode(state) as Prisma.InputJsonObject;
}

/** Reads a stored document. Anything that is not a money state is an error: a bad row is never guessed at. */
export function decodeState(stored: unknown): MoneyState {
  const state = decode(stored) as Partial<MoneyState> | null;
  if (
    typeof state !== "object" ||
    state === null ||
    typeof state.stage !== "string" ||
    typeof state.amountCents !== "number" ||
    typeof state.goAhead !== "object"
  ) {
    throw new Error("A stored money state could not be read");
  }
  return state as MoneyState;
}
