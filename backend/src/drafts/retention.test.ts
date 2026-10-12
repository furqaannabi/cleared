import { describe, expect, test } from "bun:test";
import type { MoneyView } from "../money/view";
import { endedAt } from "./retention";

const at = (iso: string) => new Date(iso);
const hold = { state: "held", reference: "HOLD-1", heldAt: at("2026-10-10T09:05:10Z"), deadlineAt: at("2026-10-24T22:59:00Z"), guaranteeEndsAt: at("2026-10-13T09:05:10Z"), day28At: at("2026-11-07T09:05:10Z") } as const;
const held: MoneyView = {
  stage: "held",
  status: null,
  amounts: { amount: "1200.00", fee: null, payout: null, currency: "USD" },
  hold,
  goAhead: { state: "none" },
  publishedAt: null,
  waitingOn: null,
  approval: null,
  capture: null,
  payout: null,
  release: null,
  closed: null,
};

describe("AH-FR-23 when a post ended, as the money path has it", () => {
  test("a post that is held, or whose hold was taken and is not yet paid, has not ended", () => {
    expect(endedAt(held)).toBeUndefined();
    expect(endedAt({ ...held, stage: "captured", payout: { status: "sending", canSendAgain: false } })).toBeUndefined();
    expect(endedAt({ ...held, stage: "not_held", hold: { state: "not_started" } })).toBeUndefined();
  });

  test("a paid post ended when its payout was paid", () => {
    expect(endedAt({ ...held, stage: "paid", payout: { status: "paid", reference: "PAYOUT-1", at: at("2026-10-12T08:00:00Z"), canSendAgain: false } })).toEqual(at("2026-10-12T08:00:00Z"));
  });

  test("a released post, and one approved and not paid, ended when the hold was given back", () => {
    const release = { reason: "deadline", at: at("2026-10-24T23:00:00Z") } as const;

    expect(endedAt({ ...held, stage: "released", release })).toEqual(at("2026-10-24T23:00:00Z"));
    expect(endedAt({ ...held, stage: "approved_not_paid", release: { reason: "day_28", at: at("2026-11-07T09:05:10Z") } })).toEqual(at("2026-11-07T09:05:10Z"));
  });

  test("a post closed without a hold ended when it was closed", () => {
    expect(endedAt({ ...held, stage: "closed_not_held", hold: { state: "not_held", because: "never_held" }, closed: { because: "never_held", at: at("2026-10-17T08:00:00Z") } })).toEqual(at("2026-10-17T08:00:00Z"));
  });

  test("a stage that says it ended, with no moment recorded for it, has not ended: nothing is deleted on a guess", () => {
    expect(endedAt({ ...held, stage: "paid", payout: { status: "paid", canSendAgain: false } })).toBeUndefined();
    expect(endedAt({ ...held, stage: "released" })).toBeUndefined();
  });
});
