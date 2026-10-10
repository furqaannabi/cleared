/**
 * What the creator is shown of a post after its draft is approved (publish to paid spec PT-FR-24,
 * PT-FR-25): pure code over the money path's view and the live check's record. It decides nothing.
 */
import { describe, expect, test } from "bun:test";
import type { CreatorMoneyView } from "../money/view";
import { laterView } from "./later";

const at = (iso: string) => new Date(iso);
const HELD = { state: "held", reference: "AUTH-1", heldAt: at("2026-10-09T09:00:00Z"), deadlineAt: at("2026-10-23T03:59:00Z"), guaranteeEndsAt: at("2026-10-12T09:00:00Z"), day28At: at("2026-11-06T09:00:00Z") } as const;

/** A held post whose draft is approved and whose creator has a running go-ahead. */
const money = (change: Partial<CreatorMoneyView> = {}): CreatorMoneyView => ({
  stage: "held",
  status: null,
  amounts: { amount: "1200.00", fee: null, payout: null, currency: "USD" },
  hold: HELD,
  goAhead: { state: "running", until: at("2026-10-11T09:00:00Z") },
  publishedAt: null,
  waitingOn: null,
  approval: null,
  capture: null,
  payout: null,
  release: null,
  closed: null,
  payoutEmail: "sam.pay@example.com",
  ...change,
});
const published = (change: Partial<CreatorMoneyView> = {}) => money({ publishedAt: at("2026-10-09T12:00:00Z"), ...change });
const captured = (change: Partial<CreatorMoneyView> = {}) =>
  published({
    stage: "captured",
    approval: { by: "live_check", at: at("2026-10-09T12:01:00Z") },
    amounts: { amount: "1200.00", fee: "60.00", payout: "1140.00", currency: "USD" },
    capture: { status: "completed", reference: "CAP-1", at: at("2026-10-09T12:01:05Z") },
    ...change,
  });

const video = { videoId: "dQw4w9WgXcQ", seenPublicAt: at("2026-10-09T12:00:00Z") };
const check = (change: Partial<NonNullable<Parameters<typeof laterView>[1]["check"]>> = {}) => ({ running: false, blockedBy: null, notFixable: null, undecided: [], ...change });

describe("PT-FR-24 the published post", () => {
  test("before anything is published there is no post, no live check and no state of its own", () => {
    expect(laterView(money(), { video: { ...video, seenPublicAt: null } })).toEqual({});
  });

  test("once it is seen public: its link, made by code from the video's id, and when it was published", () => {
    expect(laterView(published(), { video, check: check({ running: true }) })).toEqual({
      state: "published",
      post: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2026-10-09T12:00:00.000Z" },
      liveCheck: { state: "checking" },
    });
  });
});

describe("PT-FR-24 the live check's state, with the time that matters", () => {
  const live = (view: CreatorMoneyView, record = check()) => laterView(view, { video, check: record }).liveCheck;

  test("fixable: fix by the money path's time, and whether a fresh check is running", () => {
    const fixing = published({ waitingOn: { for: "creator_to_fix", until: at("2026-10-23T03:59:00Z") } });
    expect(live(fixing)).toEqual({ state: "fixable", fixBy: "2026-10-23T03:59:00.000Z" });
    expect(live(fixing, check({ running: true }))).toEqual({ state: "fixable", fixBy: "2026-10-23T03:59:00.000Z", checking: true });
  });

  test("not fixable: why, and until when the brand can accept it", () => {
    const view = published({ waitingOn: { for: "brand_to_accept", until: at("2026-10-11T12:00:00Z") } });
    expect(live(view, check({ notFixable: "not_the_approved_file" }))).toEqual({ state: "not_fixable", reason: "not_the_approved_file", brandBy: "2026-10-11T12:00:00.000Z" });
  });

  test("undecided: what could not be checked, and until when the brand can confirm or object", () => {
    const view = published({ waitingOn: { for: "brand_to_confirm", until: at("2026-10-11T12:00:00Z") } });
    expect(live(view, check({ undecided: ["file_record", "paid_promotion"] }))).toEqual({ state: "undecided", what: ["file_record", "paid_promotion"], brandBy: "2026-10-11T12:00:00.000Z" });
  });

  test("objected: the brand's reason, and that a person at Cleared rules by day 28", () => {
    const view = published({ waitingOn: { for: "cleared_to_rule", objection: "The link goes to the wrong page." } });
    expect(live(view)).toEqual({ state: "objected", reason: "The link goes to the wrong page.", ruleBy: "2026-11-06T09:00:00.000Z" });
  });

  test("passed by the check itself, or approved by someone: who", () => {
    expect(live(captured())).toEqual({ state: "passed" });
    expect(live(captured({ approval: { by: "brand_silence", at: at("2026-10-11T12:00:00Z") } }))).toEqual({ state: "approved", by: "brand_silence" });
    expect(live(captured({ approval: { by: "cleared", at: at("2026-10-11T12:00:00Z") } }))).toEqual({ state: "approved", by: "cleared" });
  });

  test("PT-FR-17 a check that stopped says why, in place of a result: reconnect YouTube, or the video is gone", () => {
    expect(live(published(), check({ blockedBy: "reconnect_youtube" }))).toEqual({ state: "reconnect_youtube" });
    expect(live(published(), check({ blockedBy: "video_not_found" }))).toEqual({ state: "video_not_found" });
  });

  test("a post its creator is fixing says to reconnect YouTube when a later check stops on lost access", () => {
    const fixing = published({ waitingOn: { for: "creator_to_fix", until: at("2026-10-23T03:59:00Z") } });
    expect(live(fixing, check({ blockedBy: "reconnect_youtube" }))).toEqual({ state: "reconnect_youtube" });
  });

  test("a released post shows no live check: the release says what happened", () => {
    const view = published({ stage: "released", release: { reason: "fix_window_ended", at: at("2026-10-23T03:59:00Z") } });
    expect(laterView(view, { video, check: check() })).toEqual({ post: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2026-10-09T12:00:00.000Z" } });
  });
});

describe("PT-FR-24, PT-BR-13 the capture and the payout, with amounts as decimal strings", () => {
  test("captured: PayPal's reference, when, the amount, Cleared's fee and what the creator is paid", () => {
    const view = laterView(captured({ payout: { status: "sending", canSendAgain: false } }), { video, check: check() });
    expect(view.state).toBe("captured");
    expect(view.capture).toEqual({ reference: "CAP-1", at: "2026-10-09T12:01:05.000Z", amount: "1200.00", fee: "60.00", payout: "1140.00" });
    expect(view.payout).toEqual({ state: "sending", email: "sam.pay@example.com", canSendAgain: false });
  });

  test("a refused capture: until when it is tried, and nothing captured", () => {
    const view = laterView(published({ approval: { by: "live_check", at: at("2026-10-09T12:01:00Z") }, capture: { status: "refused", retryUntil: at("2026-11-06T09:00:00Z") } }), { video, check: check() });
    expect(view).toMatchObject({ state: "published", capture: { refused: true, retryUntil: "2026-11-06T09:00:00.000Z" } });
    expect(view.payout).toBeUndefined();
  });

  test("a capture PayPal has not answered yet shows nothing as captured", () => {
    const view = laterView(published({ approval: { by: "live_check", at: at("2026-10-09T12:01:00Z") }, capture: { status: "started" } }), { video, check: check() });
    expect(view.capture).toBeUndefined();
  });

  test.each([
    ["unclaimed", { status: "unclaimed", canSendAgain: true }, { state: "unclaimed", canSendAgain: true }],
    ["failed, with why", { status: "failed", why: "returned", canSendAgain: true }, { state: "failed", reason: "returned", canSendAgain: true }],
    ["being cancelled so it can be sent again", { status: "cancelling", canSendAgain: false }, { state: "cancelling", canSendAgain: false }],
    ["delayed on Cleared's side", { status: "not_sent", canSendAgain: false }, { state: "delayed", canSendAgain: false }],
  ] as const)("a payout that is %s", (_what, payout, shown) => {
    expect(laterView(captured({ payout }), { video, check: check() }).payout).toEqual({ email: "sam.pay@example.com", ...shown });
  });

  test("paid: the payout's reference and when, and the post is paid", () => {
    const view = laterView(captured({ stage: "paid", payout: { status: "paid", reference: "PAYOUT-1", at: at("2026-10-09T12:02:00Z"), canSendAgain: false } }), { video, check: check() });
    expect(view.state).toBe("paid");
    expect(view.payout).toEqual({ state: "paid", email: "sam.pay@example.com", reference: "PAYOUT-1", at: "2026-10-09T12:02:00.000Z", canSendAgain: false });
  });
});

describe("PT-FR-25 states past approved", () => {
  test("approved but not paid is its own state, and a released post has none here: the review already says released", () => {
    expect(laterView(published({ stage: "approved_not_paid", approval: { by: "live_check", at: at("2026-10-09T12:01:00Z") }, release: { reason: "day_28", at: at("2026-11-06T09:00:00Z") } }), { video, check: check() }).state).toBe("approved_not_paid");
    expect(laterView(published({ stage: "released", release: { reason: "deadline", at: at("2026-10-23T03:59:00Z") } }), { video }).state).toBeUndefined();
  });
});
