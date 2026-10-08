import type { Deliverable } from "@/lib/deliverable/types";

/*
 * Mock only: what the backend's timers and PayPal would do after Approved,
 * applied when a deliverable is next read (PP FRD, following MP-FR-13 to
 * MP-FR-32). The demo's chosen outcomes ride on the deliverable in fields the
 * API schema drops, so they never reach a page.
 */

export type LiveOutcome = "passed" | "fixable" | "not_fixable" | "undecided";
export type PayoutOutcome = "paid" | "unclaimed" | "failed";
export type Mocked = Deliverable & { _live?: LiveOutcome; _checkAt?: number; _payout?: PayoutOutcome };

/** How long the mock's live check and payout take. */
export const SETTLE_MS = 3000;
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ref = (prefix: string) => `DEMO-${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const cents = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;

const LIVE_EVIDENCE: Record<Deliverable["items"][number]["kind"], string> = {
  said: "Said in the live post.",
  shown_as_text: "On screen in the live post.",
  shown: "Shown in the live post.",
  timing: "Within the time asked for.",
  written: "In the live post’s description.",
  disclosure: "The paid promotion label is on.",
  publication: "Public on your channel, before the deadline.",
};

/** MP-FR-24, MP-FR-27: the hold captured in full; the fee is 5%, in whole cents, rounded down. */
export function capture(d: Mocked, now: number) {
  // The item the live check couldn't judge was confirmed by the brand, or by its silence (MP-FR-18).
  for (const item of d.items) if (item.status === "waiting_for_brand") item.status = "accepted_by_brand";
  const fee = Math.floor((d.hold.amountMinor * 5) / 100);
  d.state = "captured";
  d.capture = { reference: ref("CAP"), at: iso(now), amount: cents(d.hold.amountMinor), fee: cents(fee), payout: cents(d.hold.amountMinor - fee) };
  d.payout = { state: "sending", email: d.payoutEmail, at: iso(now), canSendAgain: false };
  d.hold = { ...d.hold, stage: "captured" };
}

/** MP-FR-32: the hold goes back to the brand, with the reason. */
export function release(d: Mocked, now: number, reason: NonNullable<Deliverable["releaseReason"]>) {
  Object.assign(d, { state: "released", releasedAt: iso(now), releaseReason: reason, goAhead: undefined });
}

/** The live check's demo result (MP-FR-17, MP-FR-18, MP-FR-20, MP-FR-21). */
function landLiveCheck(d: Mocked, now: number) {
  const live = d._live ?? "passed";
  const checked = d.items.filter((i) => i.status === "checking");
  const flagged = checked.find((i) => i.kind === "disclosure") ?? checked[0];
  for (const item of checked) {
    const fails = item === flagged && live === "fixable";
    const waits = item === flagged && live === "undecided";
    item.status = fails ? "fix_needed" : waits ? "waiting_for_brand" : "passed";
    item.evidence = {
      label: "On the live post",
      text: fails ? "The paid promotion label is off." : waits ? "We couldn’t read the label automatically." : LIVE_EVIDENCE[item.kind],
    };
  }
  const brandBy = iso(now + 48 * HOUR);
  if (live === "passed") {
    d.liveCheck = { state: "passed" };
    capture(d, now);
  } else if (live === "fixable") {
    d.liveCheck = { state: "fixable", fixBy: iso(Math.max(Date.parse(d.deadline), now + 24 * HOUR)) };
  } else if (live === "undecided") {
    d.liveCheck = { state: "undecided", what: "the paid promotion label", brandBy };
  } else {
    d.liveCheck = { state: "not_fixable", reason: "The live post isn’t the approved draft: it’s a different cut.", brandBy };
  }
}

/**
 * Applies whatever the clock has made due: an ended go-ahead, a landed live
 * check, a brand's 48 hours, a fix window, a settled payout.
 *
 * @param d - the mock deliverable, changed in place
 * @param now - the current time
 */
export function settle(d: Mocked, now: number) {
  if (d.state === "posting" && d.goAhead?.state === "go" && Date.parse(d.goAhead.endsAt) <= now) {
    Object.assign(d, { state: "approved", goAhead: { state: "ended" } });
  }
  if (d.state === "published" && d.liveCheck?.state === "checking" && (d._checkAt ?? 0) + SETTLE_MS <= now) landLiveCheck(d, now);
  const lc = d.liveCheck;
  if (d.state === "published" && lc?.state === "undecided" && Date.parse(lc.brandBy) <= now) capture(d, now); // silence pays
  if (d.state === "published" && lc?.state === "not_fixable" && Date.parse(lc.brandBy) <= now) release(d, now, "not_accepted");
  if (d.state === "published" && lc?.state === "fixable" && Date.parse(lc.fixBy) <= now) release(d, now, "fix_window_ended");
  if (d.state === "captured" && d.payout?.state === "sending" && Date.parse(d.payout.at!) + SETTLE_MS <= now) {
    const outcome = d._payout ?? "paid";
    if (outcome === "paid") {
      d.state = "paid";
      d.payout = { ...d.payout, state: "paid", reference: ref("PAY"), at: iso(now), canSendAgain: false };
      d.hold = { ...d.hold, stage: "paid" };
    } else {
      d.payout = {
        ...d.payout,
        state: outcome,
        canSendAgain: true,
        ...(outcome === "failed" ? { reason: "PayPal says there’s no account at that email." } : {}),
      };
    }
  }
}
