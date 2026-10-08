import { describe, expect, test } from "bun:test";
import { newMoney, transition, type MoneyEvent, type MoneyState } from "./transition";
import { moneyView } from "./view";

const at = (iso: string) => new Date(iso);

function after(state: MoneyState, ...events: MoneyEvent[]): MoneyState {
  return events.reduce((current, event) => {
    const result = transition(current, event);
    if (!result.ok) throw new Error(`${event.type} was refused: ${result.reason}`);
    return result.state;
  }, state);
}

// One deliverable's story, a step at a time. Each constant is the state after the steps before it.
const fresh = newMoney({ amountCents: 120_000, deadlineDays: 14, creatorTimeZone: "Africa/Lagos" });
const agreed = after(fresh, { type: "brand_agreed", at: at("2026-10-10T08:00:00Z") });
const awaitingApproval = after(
  agreed,
  { type: "start_hold", attemptId: "att_1", at: at("2026-10-10T09:00:00Z") },
  { type: "order_created", attemptId: "att_1", orderId: "ORDER-1", at: at("2026-10-10T09:00:01Z") },
);
const authorizing = after(awaitingApproval, { type: "hold_approved", orderId: "ORDER-1", at: at("2026-10-10T09:05:00Z") });
// Held at 09:05:10 on 10 October: guaranteed to the 13th, deadline 22:59 UTC on the 24th, day 28 on 7 November.
const held = after(authorizing, {
  type: "authorize_answered",
  attemptId: "att_1",
  outcome: "held",
  reference: "AUTH-1",
  at: at("2026-10-10T09:05:10Z"),
});
const draftCleared = after(held, { type: "draft_cleared", at: at("2026-10-10T12:00:00Z") });
const confirming = after(draftCleared, { type: "go_ahead_requested", confirmId: "conf_1", at: at("2026-10-10T13:00:00Z") });
const goAhead = after(confirming, { type: "hold_confirmed", confirmId: "conf_1", at: at("2026-10-10T13:00:05Z") });
const published = after(goAhead, {
  type: "post_published",
  publishedAt: at("2026-10-11T09:30:00Z"),
  at: at("2026-10-11T09:35:00Z"),
});
const liveCheck = (result: "passed" | "cannot_decide" | "failed_fixable" | "failed_not_fixable"): MoneyEvent => ({
  type: "live_check_result",
  result,
  at: at("2026-10-11T09:40:00Z"),
});
const capturing = after(published, liveCheck("passed"), { type: "capture_started", captureId: "cap_1", at: at("2026-10-11T09:40:01Z") });
const captured = after(capturing, {
  type: "capture_answered",
  captureId: "cap_1",
  outcome: "completed",
  reference: "CAPTURE-1",
  at: at("2026-10-11T09:40:05Z"),
});
const paying = after(captured, { type: "payout_started", payoutId: "pay_1", at: at("2026-10-11T09:40:06Z") });
const payoutAnswered = (outcome: "unclaimed" | "failed" | "refused"): MoneyEvent => ({
  type: "payout_answered",
  payoutId: "pay_1",
  outcome,
  at: at("2026-10-11T09:45:00Z"),
});
const paid = after(paying, {
  type: "payout_answered",
  payoutId: "pay_1",
  outcome: "succeeded",
  reference: "PAYOUT-1",
  at: at("2026-10-11T09:45:00Z"),
});

describe("MP-FR-40 amounts, references and times", () => {
  test("amounts are decimal strings with two places, never numbers (MP-BR-05)", () => {
    expect(moneyView(held).amounts).toEqual({ amount: "1200.00", fee: null, payout: null, currency: "USD" });
    expect(moneyView(captured).amounts).toEqual({ amount: "1200.00", fee: "60.00", payout: "1140.00", currency: "USD" });
    expect(moneyView(newMoney({ amountCents: 2_005, deadlineDays: 1, creatorTimeZone: "UTC" })).amounts.amount).toBe("20.05");
  });

  test("the hold shows its PayPal reference and the three moments fixed when it was approved", () => {
    expect(moneyView(held).hold).toEqual({
      state: "held",
      reference: "AUTH-1",
      heldAt: at("2026-10-10T09:05:10Z"),
      deadlineAt: at("2026-10-24T22:59:00Z"),
      guaranteeEndsAt: at("2026-10-13T09:05:10Z"),
      day28At: at("2026-11-07T09:05:10Z"),
    });
  });

  test("each later stage shows its PayPal reference and time", () => {
    expect(moneyView(paid)).toMatchObject({
      stage: "paid",
      publishedAt: at("2026-10-11T09:30:00Z"),
      approval: { by: "live_check", at: at("2026-10-11T09:40:00Z") },
      capture: { status: "completed", reference: "CAPTURE-1", at: at("2026-10-11T09:40:05Z") },
      payout: { status: "paid", reference: "PAYOUT-1", at: at("2026-10-11T09:45:00Z"), canSendAgain: false },
    });
  });

  test("a go-ahead shows when it ends, and one that ran out says so", () => {
    expect(moneyView(goAhead).goAhead).toEqual({ state: "running", until: at("2026-10-12T09:05:10Z") });

    const ranOut = after(goAhead, { type: "go_ahead_ends_due", publishedAt: null, at: at("2026-10-12T09:05:10Z") });
    expect(moneyView(ranOut).goAhead).toEqual({ state: "ended" });
  });

  test("a refused capture shows until when it will be retried", () => {
    const refused = after(capturing, { type: "capture_answered", captureId: "cap_1", outcome: "refused", at: at("2026-10-11T09:40:05Z") });

    expect(moneyView(refused).capture).toMatchObject({ status: "refused", retryUntil: at("2026-11-07T09:05:10Z") });
  });

  test("a release shows its reason, who cancelled, and whether PayPal has confirmed it", () => {
    const cancelled = after(held, { type: "cancel_requested", by: "brand", at: at("2026-10-12T10:00:00Z") });

    expect(moneyView(cancelled).release).toEqual({ reason: "cancelled", by: "brand", at: at("2026-10-12T10:00:00Z") });
  });
});

describe("MP-BR-15 every stage short of paid has a reason and a next step", () => {
  const status = (state: MoneyState) => moneyView(state).status;
  const deadline = at("2026-10-24T22:59:00Z");
  const day28 = at("2026-11-07T09:05:10Z");

  test("before the hold", () => {
    expect(status(fresh)).toEqual({ reason: "waiting_for_agreement", next: { who: "brand", step: "agree_terms" } });
    expect(status(agreed)).toEqual({ reason: "waiting_for_hold", next: { who: "brand", step: "approve_hold" } });
    expect(status(awaitingApproval)).toEqual({ reason: "waiting_for_hold", next: { who: "brand", step: "approve_hold" } });
    expect(status(authorizing)).toEqual({ reason: "hold_with_paypal", next: { who: "paypal", step: "answer" } });

    const closed = after(awaitingApproval, { type: "hold_closed", orderId: "ORDER-1", at: at("2026-10-10T09:03:00Z") });
    expect(status(closed)).toEqual({ reason: "hold_closed", next: { who: "brand", step: "approve_hold" } });

    const declined = after(authorizing, { type: "authorize_answered", attemptId: "att_1", outcome: "declined", at: at("2026-10-10T09:05:10Z") });
    expect(status(declined)).toEqual({ reason: "hold_declined", next: { who: "brand", step: "approve_hold" } });
  });

  test("held, up to publishing", () => {
    expect(status(held)).toEqual({ reason: "waiting_for_cleared_draft", next: { who: "creator", step: "get_draft_cleared", by: deadline } });
    expect(status(draftCleared)).toEqual({ reason: "ready_to_publish", next: { who: "creator", step: "ask_for_go_ahead", by: deadline } });
    expect(status(confirming)).toEqual({ reason: "confirming_hold", next: { who: "paypal", step: "answer" } });
    expect(status(goAhead)).toEqual({ reason: "go_ahead", next: { who: "creator", step: "publish", by: at("2026-10-12T09:05:10Z") } });

    const notConfirmed = after(confirming, { type: "hold_not_confirmed", confirmId: "conf_1", at: at("2026-10-10T13:00:05Z") });
    expect(status(notConfirmed)).toEqual({ reason: "hold_not_confirmed", next: { who: "brand", step: "check_paypal_funding", by: deadline } });

    const waiting = after(draftCleared, { type: "go_ahead_requested", confirmId: "conf_1", at: at("2026-10-12T10:00:00Z") });
    expect(status(waiting)).toEqual({ reason: "guarantee_running_out", next: { who: "creator", step: "ask_for_go_ahead", from: at("2026-10-13T09:05:10Z") } });

    const ranOut = after(goAhead, { type: "go_ahead_ends_due", publishedAt: null, at: at("2026-10-12T09:05:10Z") });
    expect(status(ranOut)).toEqual({ reason: "go_ahead_ended", next: { who: "creator", step: "ask_for_go_ahead", by: deadline } });
  });

  test("after publishing", () => {
    expect(status(published)).toEqual({ reason: "waiting_for_live_check", next: { who: "cleared", step: "check_live_post" } });

    const undecided = after(published, liveCheck("cannot_decide"));
    expect(status(undecided)).toEqual({ reason: "live_check_undecided", next: { who: "brand", step: "confirm_or_object", by: at("2026-10-13T09:40:00Z") } });

    const objected = after(undecided, { type: "brand_objected", reason: "No.", at: at("2026-10-12T08:00:00Z") });
    expect(status(objected)).toEqual({ reason: "brand_objected", next: { who: "cleared", step: "rule", by: day28 } });

    expect(status(after(published, liveCheck("failed_fixable")))).toEqual({
      reason: "live_check_failed",
      next: { who: "creator", step: "fix_post", by: deadline },
    });
    expect(status(after(published, liveCheck("failed_not_fixable")))).toEqual({
      reason: "live_check_failed_for_good",
      next: { who: "brand", step: "accept_or_decline", by: at("2026-10-13T09:40:00Z") },
    });
  });

  test("capture", () => {
    expect(status(capturing)).toEqual({ reason: "capturing", next: { who: "paypal", step: "answer" } });

    const refused = after(capturing, { type: "capture_answered", captureId: "cap_1", outcome: "refused", at: at("2026-10-11T09:40:05Z") });
    expect(status(refused)).toEqual({ reason: "capture_refused", next: { who: "brand", step: "check_paypal_funding", by: day28 } });
  });

  test("payout", () => {
    expect(status(paying)).toEqual({ reason: "payout_sending", next: { who: "paypal", step: "answer" } });
    expect(status(after(paying, payoutAnswered("unclaimed")))).toEqual({
      reason: "payout_unclaimed",
      next: { who: "creator", step: "accept_payout" },
    });
    expect(status(after(paying, payoutAnswered("failed")))).toEqual({
      reason: "payout_failed",
      next: { who: "creator", step: "correct_email_and_send_again" },
    });
    expect(status(after(paying, payoutAnswered("refused")))).toEqual({
      reason: "payout_delayed",
      next: { who: "cleared", step: "fix_payout_account" },
    });
  });

  test("paid needs no reason, and a deliverable that ended any other way says why and that nothing more happens", () => {
    expect(status(paid)).toBeNull();

    const cancelled = after(held, { type: "cancel_requested", by: "brand", at: at("2026-10-12T10:00:00Z") });
    expect(status(cancelled)).toEqual({ reason: "released", next: { who: "nobody", step: "none" } });

    const neverHeld = after(agreed, { type: "never_held_due", at: at("2026-10-17T08:00:00Z") });
    expect(status(neverHeld)).toEqual({ reason: "never_held", next: { who: "nobody", step: "none" } });
    expect(moneyView(neverHeld).closed).toEqual({ because: "never_held", at: at("2026-10-17T08:00:00Z") });

    const unpaid = after(capturing, { type: "capture_answered", captureId: "cap_1", outcome: "refused", at: at("2026-10-11T09:40:05Z") }, { type: "day_28_due", at: day28 });
    expect(status(unpaid)).toEqual({ reason: "approved_not_paid", next: { who: "nobody", step: "none" } });
  });
});

describe("MP-FR-30 when the creator can have a payout sent again", () => {
  test("only after one has ended without paying, or is sitting unclaimed", () => {
    const canSendAgain = (state: MoneyState) => moneyView(state).payout?.canSendAgain;

    expect(canSendAgain(paying)).toBe(false);
    expect(canSendAgain(after(paying, payoutAnswered("unclaimed")))).toBe(true);
    expect(canSendAgain(after(paying, payoutAnswered("failed")))).toBe(true);
    expect(canSendAgain(after(paying, payoutAnswered("refused")))).toBe(false);
    expect(canSendAgain(paid)).toBe(false);
  });
});
