import { formatDay, formatDayTime, formatMoney, itemCount } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { formatAmount } from "@/lib/invite/amount";

export type JourneyActionKind = "get_go_ahead" | "posted" | "check_again" | "send_again";

/** The current step's action; `fixEmail` when the payout email needs correcting first (PP-FR-20). */
export interface JourneyAction {
  kind: JourneyActionKind;
  label: string;
  disabled: boolean;
  fixEmail?: boolean;
}

export interface JourneyStep {
  key: "approved" | "go_ahead" | "posted" | "live_check" | "captured" | "paid";
  title: string;
  state: "done" | "now" | "todo" | "problem";
  /** A line under the title: when, and the PayPal reference. */
  meta?: string;
  /** The current step's words. */
  body?: string;
  countdown?: { text: string; lastHour: boolean };
  link?: { href: string; label: string };
}

/** "From approved to paid", worked out once from the API's data (design B). */
export interface Journey {
  heading: string;
  amount: string;
  steps: JourneyStep[];
  action: JourneyAction | null;
}

/** The states the journey covers; before Approved the page keeps its money card and next step. */
export const JOURNEY_STATES: Deliverable["state"][] = ["approved", "posting", "published", "captured", "paid", "approved_not_paid"];

const NOUN: Record<Deliverable["platform"], string> = { youtube_video: "video", youtube_short: "Short", instagram_reel: "Reel" };
const WHERE: Record<Deliverable["platform"], string> = { youtube_video: "channel", youtube_short: "channel", instagram_reel: "Instagram" };

/** "31h 12m", or "42m" under an hour. */
function left(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/**
 * One deliverable's journey from Approved to Paid: each step done, current
 * or still to come, the current one with its words and action. Every time,
 * amount, fee and reference is the API's; the page works none out and
 * decides no money state (PP-BR-01, PP-BR-07).
 *
 * @param d - the deliverable, in one of JOURNEY_STATES
 * @param now - the current time, for countdowns
 * @param options.timeZone - the viewer's timezone for times
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-23; DESIGN.md "Publish and pay (the journey)"
 */
export function journey(d: Deliverable, now: Date, { timeZone }: { timeZone?: string } = {}): Journey {
  const b = d.brandName;
  const at = (iso: string) => formatDayTime(iso, timeZone);
  const day = (iso: string) => formatDay(iso, timeZone);
  const s = d.state;
  const order = ["approved", "posting", "published", "captured", "paid"];
  const past = (state: string) => order.indexOf(s) > order.indexOf(state);
  let action: JourneyAction | null = null;

  const approved: JourneyStep = {
    key: "approved",
    title: "Draft approved",
    state: "done",
    meta: d.approvedAt ? `${d.approvedBy === "window" ? "No objection in 48 hours" : `By ${b}`} · ${day(d.approvedAt)}` : undefined,
  };

  // PP-FR-01 to PP-FR-05
  const go: JourneyStep = { key: "go_ahead", title: "Go-ahead to post", state: "done" };
  if (s === "approved") {
    const g = d.goAhead;
    go.state = "now";
    if (g?.state === "wait") {
      Object.assign(go, { title: `Wait until ${at(g.until)}`, body: `PayPal can renew ${b}’s hold from then. Ask again then.` });
      action = { kind: "get_go_ahead", label: "Get the go-ahead", disabled: true };
    } else if (g?.state === "not_confirmed") {
      Object.assign(go, { state: "problem", title: "Don’t post yet", body: `PayPal couldn’t confirm ${b}’s hold. We’ve told ${b} to check their PayPal. You can ask again.` });
      action = { kind: "get_go_ahead", label: "Ask again", disabled: false };
    } else if (g?.state === "ended") {
      Object.assign(go, { title: "Your go-ahead ended", body: "It ended before you posted. Ask again when you’re ready." });
      action = { kind: "get_go_ahead", label: "Get the go-ahead", disabled: false };
    } else {
      Object.assign(go, { title: "Ready to post?", body: "Get the go-ahead when you’re about to post. It lasts up to 48 hours." });
      action = { kind: "get_go_ahead", label: "Get the go-ahead", disabled: false };
    }
  } else if (s === "posting" && d.goAhead?.state === "go") {
    const ms = Date.parse(d.goAhead.endsAt) - now.getTime();
    Object.assign(go, {
      state: "now",
      title: "You can post now",
      meta: "Go-ahead · PayPal confirmed the hold",
      countdown: { text: left(ms), lastHour: ms < 3_600_000 },
      body: `Post before ${at(d.goAhead.endsAt)}. If you forget to tap, we check your ${WHERE[d.platform]} when your go-ahead ends.`,
    });
    action = { kind: "posted", label: "I’ve posted it", disabled: false };
  }

  const posted: JourneyStep = d.post
    ? {
        key: "posted",
        title: "Posted",
        state: "done",
        meta: at(d.post.publishedAt),
        ...(d.post.url ? { link: { href: d.post.url, label: "View your post" } } : {}),
      }
    : { key: "posted", title: "Posted", state: past("posting") ? "done" : "todo" };

  // PP-FR-09 to PP-FR-15
  const live: JourneyStep = { key: "live_check", title: "Live check", state: past("published") || d.liveCheck?.state === "passed" ? "done" : "todo" };
  if (live.state === "done") live.title = "Live check passed";
  if (s === "published") {
    const lc = d.liveCheck;
    if (lc?.state === "checking") Object.assign(live, { state: "now", title: "Checking your live post…", body: "We’re checking what can only be checked once it’s live." });
    else if (lc?.state === "fixable") {
      const failing = d.items.filter((i) => i.status === "fix_needed");
      Object.assign(live, {
        state: "problem",
        title: `${itemCount(failing.length)} to fix on your live post`,
        body: `Fix ${failing.map((i) => i.name).join(", ")} and check again before ${at(lc.fixBy)}.`,
      });
      action = { kind: "check_again", label: "Check again", disabled: false };
    } else if (lc?.state === "undecided")
      Object.assign(live, {
        state: "now",
        title: `${b} to confirm`,
        body: `We couldn’t check ${lc.what} automatically. ${b} has until ${at(lc.brandBy)} to confirm. If they say nothing, you’re paid. If they object, a person at Cleared decides.`,
      });
    else if (lc?.state === "not_fixable")
      Object.assign(live, { state: "now", title: `${b} to accept`, body: `${lc.reason} ${b} has until ${at(lc.brandBy)} to accept it anyway. If they don’t, the hold goes back to them.` });
    else if (lc?.state === "objected")
      Object.assign(live, { state: "now", title: "A person at Cleared is deciding", body: `${b} objected: “${lc.reason}”. We decide by ${day(lc.ruleBy)}.` });
  }

  // PP-FR-16 to PP-FR-23
  const c = d.capture;
  const captured: JourneyStep = c
    ? { key: "captured", title: "Captured", state: "done", meta: `${day(c.at)} · PayPal ref ${c.reference} · less Cleared’s 5% fee, ${formatAmount(c.fee)}` }
    : { key: "captured", title: "Captured", state: "todo", meta: `${formatMoney(d.hold.amountMinor, d.hold.currency)} from ${b}` };
  if (d.captureRefused) {
    Object.assign(captured, { state: "now", body: `Approved. PayPal couldn’t take ${b}’s payment yet. We try again until ${day(d.captureRefused.retryUntil)} and have told ${b}.` });
  }
  if (s === "approved_not_paid") {
    Object.assign(captured, { state: "problem", body: `This post was approved, but PayPal never let Cleared collect ${b}’s payment, so you weren’t paid through Cleared.` });
  }

  const p = d.payout;
  const paid: JourneyStep = { key: "paid", title: "Paid", state: "todo", meta: `To ${d.payoutEmail}, after Cleared’s 5% fee` };
  if (c && p) {
    const amount = formatAmount(c.payout);
    if (p.state === "paid") Object.assign(paid, { state: "done", title: `Paid ${amount} to ${p.email}`, meta: `${p.at ? `${day(p.at)} · ` : ""}Payout ref ${p.reference} · after Cleared’s 5% fee` });
    else if (p.state === "sending") Object.assign(paid, { state: "now", title: `Sending ${amount} to ${p.email}`, meta: undefined, body: "PayPal usually takes a few minutes." });
    else if (p.state === "unclaimed") {
      Object.assign(paid, { state: "problem", title: `PayPal is holding ${amount} for ${p.email}`, meta: "Payout unclaimed", body: "Accept it in PayPal with that email, or have it sent again." });
      if (p.canSendAgain) action = { kind: "send_again", label: "Send it again", disabled: false };
    } else {
      Object.assign(paid, { state: "problem", title: `${amount} couldn’t be paid to ${p.email}`, meta: undefined, body: `${p.reason ?? "PayPal returned it."} Correct your PayPal email and send it again.` });
      if (p.canSendAgain) action = { kind: "send_again", label: "Save and send it again", disabled: false, fixEmail: true };
    }
  }

  const steps = [approved, go, posted, live, captured, paid];
  // Everything before the current step is done.
  const firstOpen = steps.findIndex((st) => st.state !== "done");
  steps.forEach((st, i) => {
    if (firstOpen >= 0 && i > firstOpen && st.state === "done" && st.key !== "posted") st.state = "todo";
  });

  const heading = s === "paid" ? "Cleared" : s === "approved_not_paid" ? "Approved, not paid" : c ? `Captured from ${b}` : `Held for this ${NOUN[d.platform]}`;
  const amount = s === "paid" && c ? formatAmount(c.payout) : c ? formatAmount(c.amount) : formatMoney(d.hold.amountMinor, d.hold.currency);
  return { heading, amount, steps, action: s === "paid" ? null : action };
}
