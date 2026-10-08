import { describe, expect, test } from "bun:test";
import { decodeState, encodeState } from "./codec";
import { newMoney, transition, type MoneyEvent, type MoneyState } from "./transition";

const at = (iso: string) => new Date(iso);

/** A state with every kind of value in it: dates at several depths, nulls, numbers and optional fields. */
function busyState(): MoneyState {
  const events: MoneyEvent[] = [
    { type: "brand_agreed", at: at("2026-10-10T08:00:00Z") },
    { type: "start_hold", attemptId: "att_1", at: at("2026-10-10T09:00:00Z") },
    { type: "order_created", attemptId: "att_1", orderId: "ORDER-1", at: at("2026-10-10T09:00:01Z") },
    { type: "hold_approved", orderId: "ORDER-1", at: at("2026-10-10T09:05:00Z") },
    { type: "authorize_answered", attemptId: "att_1", outcome: "held", reference: "AUTH-1", at: at("2026-10-10T09:05:10Z") },
    { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") },
    { type: "go_ahead_requested", confirmId: "conf_1", at: at("2026-10-10T13:00:00Z") },
    { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T13:00:05Z") },
    { type: "post_published", publishedAt: at("2026-10-11T09:30:00Z"), at: at("2026-10-11T09:35:00Z") },
    { type: "live_check_result", result: "passed", at: at("2026-10-11T09:40:00Z") },
    { type: "capture_started", captureId: "cap_1", at: at("2026-10-11T09:40:01Z") },
    { type: "capture_answered", captureId: "cap_1", outcome: "completed", reference: "CAPTURE-1", at: at("2026-10-11T09:40:05Z") },
    { type: "payout_started", payoutId: "pay_1", at: at("2026-10-11T09:40:06Z") },
  ];
  return events.reduce(
    (state, event) => {
      const result = transition(state, event);
      if (!result.ok) throw new Error(`${event.type} was refused: ${result.reason}`);
      return result.state;
    },
    newMoney({ amountCents: 120_000, deadlineDays: 14, creatorTimeZone: "Africa/Lagos" }),
  );
}

describe("the money state as a stored document (MP 1.4)", () => {
  test("a state comes back from the database exactly as it went in, dates included", () => {
    const state = busyState();

    // What Postgres does to a JSON column: it keeps only what JSON can hold.
    const stored: unknown = JSON.parse(JSON.stringify(encodeState(state)));

    expect(decodeState(stored)).toEqual(state);
    expect(decodeState(stored).hold?.deadlineAt).toBeInstanceOf(Date);
  });

  test("a fresh state round-trips too", () => {
    const state = newMoney({ amountCents: 2_000, deadlineDays: 1, creatorTimeZone: "America/Los_Angeles" });

    expect(decodeState(JSON.parse(JSON.stringify(encodeState(state))))).toEqual(state);
  });

  test("a stored document that is not a money state is an error, not a guess", () => {
    expect(() => decodeState(null)).toThrow();
    expect(() => decodeState({ amountCents: 100 })).toThrow();
  });
});
