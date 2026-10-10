/**
 * What the creator is shown of a post after its draft is approved (publish to paid spec PT-FR-24,
 * PT-FR-25): the published post, where its live check stands, the capture and the payout. Pure code
 * over the money path's own view and the live check's record. It reads and decides nothing: every
 * state, time and amount here is the money path's, in the words the creator's page uses.
 */
import type { CreatorMoneyView, MoneyView } from "../money/view";

const UNDECIDED = ["file_record", "paid_promotion", "written_item"] as const;
type Undecided = (typeof UNDECIDED)[number];

/** Where the live check stands. A check that could not look says why in place of a result (PT-FR-17). */
export type PostLiveCheck =
  | { state: "checking" | "passed" | "reconnect_youtube" | "video_not_found" }
  /** Paying was approved by someone, not by the check alone. */
  | { state: "approved"; by: "brand_confirmed" | "brand_silence" | "brand_accepted" | "cleared" }
  | { state: "fixable"; fixBy: string; checking?: true }
  | { state: "not_fixable"; reason: "not_your_channel" | "not_the_approved_file"; brandBy: string }
  | { state: "undecided"; what: Undecided[]; brandBy: string }
  /** The brand's reason is its own plain text (PT-BR-10). */
  | { state: "objected"; reason: string; ruleBy: string };

/** The hold taken, or PayPal's refusal and until when it is tried again (MP-FR-25). Amounts are decimal strings (PT-BR-13). */
export type PostCapture = { reference: string; at: string; amount: string; fee: string; payout: string } | { refused: true; retryUntil: string };

export interface PostPayout {
  /** delayed: PayPal will not send it yet, for a reason on Cleared's side (MP-FR-45). */
  state: "sending" | "cancelling" | "delayed" | "unclaimed" | "failed" | "paid";
  /** The PayPal email it goes to. For the creator only (PT-BR-09). */
  email: string;
  reason?: "failed" | "returned" | "blocked" | "denied";
  reference?: string;
  at?: string;
  canSendAgain: boolean;
}

export interface Later {
  /** The post's state once it is past "posting". Absent before it is published, and for a released post. */
  state?: "published" | "captured" | "paid" | "approved_not_paid";
  post?: { url: string; publishedAt: string };
  liveCheck?: PostLiveCheck;
  capture?: PostCapture;
  payout?: PostPayout;
}

/** The live check's record, as much of it as the view needs. */
export interface LiveRecord {
  running: boolean;
  blockedBy: string | null;
  notFixable: string | null;
  undecided: unknown;
}

const undecidedOf = (check: LiveRecord | undefined): Undecided[] => {
  const listed = Array.isArray(check?.undecided) ? check.undecided : [];
  return UNDECIDED.filter((what) => listed.includes(what));
};
const notFixableOf = (check: LiveRecord | undefined) => (check?.notFixable === "not_your_channel" ? ("not_your_channel" as const) : ("not_the_approved_file" as const));
const ruleBy = (money: MoneyView) => (money.hold.state === "held" ? money.hold.day28At : new Date(0)).toISOString();
const linkTo = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

function liveCheckOf(money: CreatorMoneyView, check: LiveRecord | undefined): PostLiveCheck {
  if (money.approval) return money.approval.by === "live_check" ? { state: "passed" } : { state: "approved", by: money.approval.by };
  if (check && !check.running && (check.blockedBy === "reconnect_youtube" || check.blockedBy === "video_not_found")) return { state: check.blockedBy };
  const waiting = money.waitingOn;
  switch (waiting?.for) {
    case "creator_to_fix":
      return { state: "fixable", fixBy: waiting.until.toISOString(), ...(check?.running ? { checking: true as const } : {}) };
    case "brand_to_accept":
      return { state: "not_fixable", reason: notFixableOf(check), brandBy: waiting.until.toISOString() };
    case "brand_to_confirm":
      return { state: "undecided", what: undecidedOf(check), brandBy: waiting.until.toISOString() };
    case "cleared_to_rule":
      return { state: "objected", reason: waiting.objection, ruleBy: ruleBy(money) };
    default:
      return { state: "checking" };
  }
}

function captureOf(money: CreatorMoneyView): PostCapture | undefined {
  const { capture, amounts } = money;
  if (capture?.status === "refused" && capture.retryUntil) return { refused: true, retryUntil: capture.retryUntil.toISOString() };
  if (capture?.status !== "completed" || !capture.reference || !capture.at || amounts.fee === null || amounts.payout === null) return undefined;
  return { reference: capture.reference, at: capture.at.toISOString(), amount: amounts.amount, fee: amounts.fee, payout: amounts.payout };
}

function payoutOf(money: CreatorMoneyView): PostPayout | undefined {
  const payout = money.payout;
  if (!payout) return undefined;
  return {
    state: payout.status === "not_sent" ? "delayed" : payout.status,
    email: money.payoutEmail,
    ...(payout.why ? { reason: payout.why as PostPayout["reason"] } : {}),
    ...(payout.reference ? { reference: payout.reference } : {}),
    ...(payout.at ? { at: payout.at.toISOString() } : {}),
    canSendAgain: payout.canSendAgain,
  };
}

export function laterView(money: CreatorMoneyView, live: { video?: { videoId: string; seenPublicAt: Date | null }; check?: LiveRecord }): Later {
  const publishedAt = money.publishedAt ?? live.video?.seenPublicAt ?? null;
  if (!publishedAt) return {};
  const ended = money.stage === "released" || money.stage === "closed_not_held";
  const state = money.stage === "held" ? "published" : money.stage === "captured" || money.stage === "paid" || money.stage === "approved_not_paid" ? money.stage : undefined;
  const capture = captureOf(money);
  const payout = payoutOf(money);
  return {
    ...(state ? { state } : {}),
    // The link is made here from the id code took from the creator's link. Nothing the creator typed is echoed.
    ...(live.video ? { post: { url: linkTo(live.video.videoId), publishedAt: publishedAt.toISOString() } } : {}),
    ...(ended ? {} : { liveCheck: liveCheckOf(money, live.check) }),
    ...(capture ? { capture } : {}),
    ...(payout ? { payout } : {}),
  };
}

/**
 * Where a post stands for the brand once its draft is approved (PT-FR-23). It is built from the plain
 * money view, which holds no PayPal email, and it never says how a payout is going: only whether the
 * creator has been paid (PT-BR-09).
 */
export type BrandLaterReview =
  | { state: "posting"; postBy: string }
  /** The live post is being checked, or its creator is fixing it. */
  | { state: "live_check" }
  | { state: "confirm"; endsAt: string; what: Undecided[] }
  | { state: "accept"; endsAt: string; reason: "not_your_channel" | "not_the_approved_file" }
  /** The brand objected. Its reason is its own plain text. */
  | { state: "with_cleared"; reason: string; ruleBy: string }
  /** Paying is approved and PayPal is being asked for the money. */
  | { state: "taking" }
  | { state: "capture_refused"; retryUntil: string }
  | { state: "taken"; amount: string; reference: string; at: string; creatorPaid: boolean }
  | { state: "approved_not_paid" };

export interface BrandLater {
  review?: BrandLaterReview;
  /** The live post's link, made by code from the video's id. */
  post?: { url: string };
}

function brandReviewOf(money: MoneyView, check: LiveRecord | undefined, published: boolean): BrandLaterReview | undefined {
  if (money.stage === "released" || money.stage === "closed_not_held") return undefined;
  if (money.stage === "approved_not_paid") return { state: "approved_not_paid" };
  const { capture } = money;
  if ((money.stage === "captured" || money.stage === "paid") && capture?.reference && capture.at) {
    return { state: "taken", amount: money.amounts.amount, reference: capture.reference, at: capture.at.toISOString(), creatorPaid: money.stage === "paid" };
  }
  if (capture?.status === "refused" && capture.retryUntil) return { state: "capture_refused", retryUntil: capture.retryUntil.toISOString() };
  if (money.approval) return { state: "taking" };
  const waiting = money.waitingOn;
  if (waiting?.for === "brand_to_confirm") return { state: "confirm", endsAt: waiting.until.toISOString(), what: undecidedOf(check) };
  if (waiting?.for === "brand_to_accept") return { state: "accept", endsAt: waiting.until.toISOString(), reason: notFixableOf(check) };
  if (waiting?.for === "cleared_to_rule") return { state: "with_cleared", reason: waiting.objection, ruleBy: ruleBy(money) };
  if (published) return { state: "live_check" };
  return money.goAhead.state === "running" ? { state: "posting", postBy: money.goAhead.until.toISOString() } : undefined;
}

export function brandLater(money: MoneyView, live: { video?: { videoId: string; seenPublicAt: Date | null }; check?: LiveRecord }): BrandLater {
  const published = !!(money.publishedAt ?? live.video?.seenPublicAt);
  const review = brandReviewOf(money, live.check, published);
  return { ...(review ? { review } : {}), ...(published && live.video ? { post: { url: linkTo(live.video.videoId) } } : {}) };
}
