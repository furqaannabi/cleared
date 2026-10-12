import { formatDay, formatDayTime, formatMoney, itemCount } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { formatAmount } from "@/lib/invite/amount";
import { notFixableWords, payoutReasonWords, undecidedWords } from "./live-words";

export type JourneyActionKind = "get_go_ahead" | "posted" | "check_again" | "send_again" | "reconnect";

/** The current step's action; `fixEmail` when the payout email needs correcting first (PP-FR-20). */
export interface JourneyAction {
  kind: JourneyActionKind;
  label: string;
  disabled: boolean;
  fixEmail?: boolean;
  /** PP-FR-01 (1.3): the go-ahead takes the unlisted YouTube video's link; never for a Reel. */
  videoLink?: true;
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
  /** The money header: marigold while the money moves towards the creator, white once paid, latte if it stopped. */
  tone: "money" | "cleared" | "stopped";
  heading: string;
  amount: string;
  /** The line under the amount: the latest PayPal reference and its date. */
  reference: string;
  steps: JourneyStep[];
  action: JourneyAction | null;
}

/** The states the journey covers; before Approved the page keeps its money card and next step. */
export const JOURNEY_STATES: Deliverable["state"][] = ["approved", "posting", "published", "captured", "paid", "approved_not_paid"];

const NOUN: Record<Deliverable["platform"], string> = { youtube_video: "video", youtube_short: "Short", instagram_reel: "Reel" };
const WHERE: Record<Deliverable["platform"], string> = { youtube_video: "channel", youtube_short: "channel", instagram_reel: "Instagram" };

const APPROVED_BY: Record<Extract<NonNullable<Deliverable["liveCheck"]>, { state: "approved" }>["by"], (brand: string) => string> = {
  brand_confirmed: (b) => `${b} confirmed your live post.`,
  brand_silence: (b) => `${b} didn’t answer in 48 hours, so your live post is approved.`,
  brand_accepted: (b) => `${b} accepted your live post.`,
  cleared: () => "A person at Cleared approved your live post.",
};

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
 * @param options.channel - the creator's connected channel or account name, when known (PP-FR-37, PP-FR-38)
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-23; DESIGN.md "Publish and pay (the journey)"
 */
export function journey(d: Deliverable, now: Date, { timeZone, channel }: { timeZone?: string; channel?: string } = {}): Journey {
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
    } else if (g?.state === "confirming") {
      // PP-FR-01 (1.3): PayPal is being asked; the page asks the API again until it answers.
      Object.assign(go, { title: `Checking ${b}’s hold with PayPal…` });
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
    if (action && d.platform !== "instagram_reel") action.videoLink = true;
  } else if (s === "posting" && d.goAhead?.state === "go") {
    const ms = Date.parse(d.goAhead.endsAt) - now.getTime();
    Object.assign(go, {
      state: "now",
      title: "You can post now",
      meta: "Go-ahead · PayPal confirmed the hold",
      countdown: { text: left(ms), lastHour: ms < 3_600_000 },
      // PP-FR-08 (1.3): Cleared doesn't look for a Reel it wasn't given.
      body:
        d.platform === "instagram_reel"
          ? `Post before ${at(d.goAhead.endsAt)}. Give us your Reel’s link before ${at(d.deadline)}. We don’t look for it.`
          : `Post before ${at(d.goAhead.endsAt)}. If you forget to tap, we check your ${WHERE[d.platform]} when your go-ahead ends.`,
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
  const approvedLive = d.liveCheck?.state === "passed" || d.liveCheck?.state === "approved";
  const live: JourneyStep = { key: "live_check", title: "Live check", state: past("published") || approvedLive ? "done" : "todo" };
  if (live.state === "done") live.title = "Live check passed";
  // PP-FR-39 (1.3): approved by someone other than the live check.
  if (d.liveCheck?.state === "approved") live.title = APPROVED_BY[d.liveCheck.by](b);
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
      // PP-FR-12 (1.3): a check again in flight.
      action = lc.checking ? { kind: "check_again", label: "Checking again…", disabled: true } : { kind: "check_again", label: "Check again", disabled: false };
    } else if (lc?.state === "undecided")
      Object.assign(live, {
        state: "now",
        title: `${b} to confirm`,
        body: `We couldn’t check ${undecidedWords(lc.what)} automatically. ${b} has until ${at(lc.brandBy)} to confirm. If they say nothing, you’re paid. If they object, a person at Cleared decides.`,
      });
    else if (lc?.state === "not_fixable")
      Object.assign(live, { state: "now", title: `${b} to accept`, body: `${notFixableWords[lc.reason]} ${b} has until ${at(lc.brandBy)} to accept it anyway. If they don’t, the hold goes back to them.` });
    // PP-FR-38 (1.3): the check can't run yet; the deadline still runs.
    else if (lc?.state === "reconnect_youtube") {
      Object.assign(live, {
        state: "problem",
        title: "We can’t read your YouTube channel, so your live post isn’t checked yet.",
        body: "Reconnect YouTube and we check it straight away. Your deadline still runs.",
      });
      action = { kind: "reconnect", label: "Reconnect YouTube", disabled: false };
    } else if (lc?.state === "video_not_found") {
      Object.assign(live, {
        state: "problem",
        title: "We can’t find your video on YouTube.",
        body: `Make sure it’s still on ${channel ?? "your channel"} and public, then tap I’ve posted it again. Your deadline still runs.`,
      });
      action = { kind: "posted", label: "I’ve posted it", disabled: false };
    } else if (lc?.state === "objected")
      Object.assign(live, { state: "now", title: "A person at Cleared is deciding", body: `${b} objected: “${lc.reason}”. We decide by ${day(lc.ruleBy)}.` });
  }

  // PP-FR-16 to PP-FR-23, PP-FR-35, PP-FR-36
  // PP-FR-21: a refused capture comes in `capture` itself (1.3).
  const c = d.capture && "reference" in d.capture ? d.capture : undefined;
  const refused = d.capture && "refused" in d.capture ? d.capture : undefined;
  const captured: JourneyStep = c
    ? { key: "captured", title: "Captured", state: "done", meta: `${day(c.at)} · PayPal ref ${c.reference} · less Cleared’s 5% fee, ${formatAmount(c.fee)}` }
    : { key: "captured", title: "Captured", state: "todo", meta: `${formatMoney(d.hold.amountMinor, d.hold.currency)} from ${b}` };
  // PP-FR-39 (1.3): approved, waiting for the capture.
  if (s === "published" && approvedLive && !c && !refused) Object.assign(captured, { state: "now", body: `Collecting ${b}’s payment with PayPal…` });
  if (refused) {
    Object.assign(captured, { state: "now", body: `Approved. PayPal couldn’t take ${b}’s payment yet. We try again until ${day(refused.retryUntil)} and have told ${b}.` });
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
    else if (p.state === "cancelling")
      Object.assign(paid, { state: "now", title: `Sending ${amount} again`, meta: undefined, body: `PayPal is cancelling the unclaimed payment first, then we send it to ${p.email}.` });
    else if (p.state === "delayed")
      Object.assign(paid, {
        state: "now",
        title: `Sending ${amount} to ${p.email} is delayed`,
        meta: undefined,
        body: "The delay is on Cleared’s side, with our PayPal account. Your money is safe with Cleared, and we keep trying until it’s sent. There’s nothing you need to do.",
      });
    else if (p.state === "unclaimed") {
      Object.assign(paid, { state: "problem", title: `PayPal is holding ${amount} for ${p.email}`, meta: "Payout unclaimed", body: "Accept it in PayPal with that email, or have it sent again." });
      if (p.canSendAgain) action = { kind: "send_again", label: "Send it again", disabled: false };
    } else {
      Object.assign(paid, { state: "problem", title: `${amount} couldn’t be paid to ${p.email}`, meta: undefined, body: `${p.reason ? payoutReasonWords[p.reason] : "PayPal returned it."} Correct your PayPal email and send it again.` });
      if (p.canSendAgain) action = { kind: "send_again", label: "Save and send it again", disabled: false, fixEmail: true };
    }
  }

  const steps = [approved, go, posted, live, captured, paid];
  // Everything before the current step is done.
  const firstOpen = steps.findIndex((st) => st.state !== "done");
  steps.forEach((st, i) => {
    if (firstOpen >= 0 && i > firstOpen && st.state === "done" && st.key !== "posted") st.state = "todo";
  });

  // PP-FR-16: the money card (DESIGN.md "Money card") carried through to Paid.
  const tone = s === "paid" ? "cleared" : s === "approved_not_paid" ? "stopped" : "money";
  const heading = s === "paid" ? "Cleared" : s === "approved_not_paid" ? "Approved, not paid" : c ? `Captured from ${b}` : `Held in PayPal for this ${NOUN[d.platform]}`;
  const amount = s === "paid" && c ? formatAmount(c.payout) : c ? formatAmount(c.amount) : formatMoney(d.hold.amountMinor, d.hold.currency);
  const reference =
    s === "paid" && p
      ? `Paid to ${p.email}${p.at ? ` · ${day(p.at)}` : ""}`
      : c
        ? `PayPal ref ${c.reference} · ${day(c.at)}`
        : `Ref ${d.hold.reference} · held ${day(d.hold.heldAt)}`;
  return { tone, heading, amount, reference, steps, action: s === "paid" ? null : action };
}
