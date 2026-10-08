import { formatDay, formatDayTime, formatDuration, formatMoney, itemCount } from "./format";
import { deadlineView, postBy as postByText } from "./deadline";
import type { CheckFailure, Deliverable } from "./types";
import { journey } from "@/lib/publish/journey";

export type NextStepAction = "upload_draft" | "upload_new_draft" | "upload_again" | "try_again";

/** DC-FR-30: what happens next and who acts, in one or two sentences. */
export interface NextStep {
  lead: string;
  detail: string;
  action: NextStepAction | null;
}

/**
 * The next-step bar for a deliverable in its current state.
 *
 * @param d - the deliverable
 * @param timeZone - the viewer's timezone for dates
 * @see docs/specs/creator-draft-check-frd.md DC-FR-30
 */
export function nextStep(d: Deliverable, timeZone?: string): NextStep {
  const postBy = postByText(deadlineView(d, timeZone));
  const beforePublish = d.items.filter((i) => i.status !== "at_live_check").length;

  switch (d.state) {
    case "no_draft":
      return {
        lead: "Upload your draft to start the draft check.",
        detail: `It’s checked against the ${itemCount(d.items.length)} you and ${d.brandName} agreed. ${postBy}`,
        action: "upload_draft",
      };
    case "checking":
      return {
        lead: `We’re checking your draft against the ${itemCount(beforePublish)} that can be checked before publishing.`,
        detail: "You can leave this page; results will be here when it’s done.",
        action: null,
      };
    case "results":
      return resultsStep(d, postBy);
    case "fully_passing":
      return {
        lead: `Every item passed. ${d.brandName} has until ${d.reviewWindowEndsAt ? formatDayTime(d.reviewWindowEndsAt, timeZone) : "the end of the review window"} to review.`,
        detail: "If they say nothing by then, you’re cleared to publish.",
        action: null,
      };
    case "objected": {
      // DC-FR-50: the brand's objections, settled by the two sides (docs/decisions/2026-10-08-objection-settled-by-the-two-sides.md).
      const n = d.items.filter((i) => i.status === "objected_by_brand").length;
      return {
        lead: `${d.brandName} asked you to fix ${itemCount(n)}. Upload a new draft by ${deadlineView(d, timeZone).date}.`,
        detail: `If ${d.brandName} approves this draft instead, you’re cleared to publish.`,
        action: "upload_new_draft",
      };
    }
    case "approved":
      // DC-FR-51: never "publish now"; the hold is re-confirmed first (step 6).
      return {
        lead: d.approvedBy === "window" ? `No objection from ${d.brandName} in 48 hours, so this draft is approved.` : `${d.brandName} approved this draft.`,
        detail: `Don’t publish yet. Cleared confirms ${d.brandName}’s hold with PayPal first.`,
        action: null,
      };
    // PP FRD: past Approved the journey says what happens next; its action lives in the journey panel.
    case "posting":
    case "published":
    case "captured":
    case "paid":
    case "approved_not_paid": {
      const step = journey(d, new Date(), { timeZone }).steps.find((s) => s.state === "now" || s.state === "problem");
      return step
        ? { lead: step.title.endsWith("…") || step.title.endsWith(".") ? step.title : `${step.title}.`, detail: step.body ?? "", action: null }
        : { lead: "Cleared. Nothing more to do on this post.", detail: "", action: null };
    }
    case "check_failed":
      return checkFailedStep(d);
    case "released":
      return releasedStep(d, timeZone);
  }
}

function resultsStep(d: Deliverable, postBy: string): NextStep {
  const toFix = d.items.filter((i) => i.status === "fix_needed").length;
  // An unsure item is a choice: show it more clearly, or ask the brand to accept it.
  const unsure = d.items.filter((i) => i.status === "unsure").length;
  const waiting = d.items.filter((i) => i.status === "waiting_for_brand").length;
  const waitingText = `${itemCount(waiting)} ${waiting === 1 ? "is" : "are"} waiting for ${d.brandName}`;
  const review = `${d.brandName}’s 48-hour review starts once every item passes.`;
  const unsureText = `${unsure} unsure ${unsure === 1 ? "item" : "items"}`;

  if (toFix === 0 && unsure === 0) {
    return { lead: `${waitingText}.`, detail: `You can still upload a fix yourself. ${postBy}`, action: "upload_new_draft" };
  }
  if (toFix === 0) {
    const them = unsure === 1 ? "it" : "them";
    return {
      lead: `Decide on ${unsureText}.`,
      detail: `Show ${them} more clearly in a new draft, or ask ${d.brandName} to accept ${them}. ${review}`,
      action: "upload_new_draft",
    };
  }
  if (unsure > 0) {
    return {
      lead: `Fix ${itemCount(toFix)}, and decide on ${unsureText}.`,
      detail: `For the unsure ${unsure === 1 ? "one" : "ones"}, show ${unsure === 1 ? "it" : "them"} more clearly in a new draft or ask ${d.brandName} to accept ${unsure === 1 ? "it" : "them"}. ${review}`,
      action: "upload_new_draft",
    };
  }
  return {
    lead: `Fix ${itemCount(toFix)}, then upload a new draft.`,
    detail: waiting ? `${waitingText}; you can still fix ${waiting === 1 ? "it" : "them"} yourself. ${postBy}` : review,
    action: "upload_new_draft",
  };
}

function checkFailedStep(d: Deliverable): NextStep {
  // DC-FR-30: the check-failed banner explains (and says the hold is safe); the bar states only the action.
  const f = d.checkFailure;
  if (!f) return { lead: "Upload your draft again.", detail: "", action: "upload_again" };
  if (f.kind === "ours") {
    return f.retrying
      ? { lead: "Nothing to do right now. We’re trying the check again.", detail: "", action: null }
      : { lead: "Try the check again. Your draft doesn’t need to change.", detail: "", action: "try_again" };
  }
  return { lead: fileProblem(f).lead, detail: "", action: "upload_again" };
}

export function fileProblem(f: Extract<CheckFailure, { kind: "file" }>): { lead: string; why: string } {
  switch (f.reason) {
    case "too_long":
      return {
        lead: "Upload a shorter cut of your draft.",
        why:
          f.lengthSec != null && f.lengthCapSec != null
            ? `${f.fileName} is ${formatDuration(f.lengthSec)} long, and drafts can be up to ${formatDuration(f.lengthCapSec)}.`
            : `${f.fileName} is longer than drafts can be.`,
      };
    case "unreadable":
      return { lead: "Upload your draft again.", why: `We couldn’t read ${f.fileName}; the file may be damaged.` };
    case "format":
      return { lead: "Upload your draft as a different file type.", why: `We can’t check ${f.fileName} in this format.` };
    case "not_same_video":
      return {
        lead: "Upload the same video you put on YouTube as unlisted.",
        why: `${f.fileName} doesn’t match your unlisted YouTube upload.`,
      };
  }
}

function releasedStep(d: Deliverable, timeZone?: string): NextStep {
  const amount = formatMoney(d.hold.amountMinor, d.hold.currency);
  const on = d.releasedAt ? ` on ${formatDay(d.releasedAt, timeZone)}` : "";
  const end = "Nothing more can happen on this deliverable.";
  let why: string;
  if (d.releaseReason === "deadline") {
    why = `The deadline of ${deadlineView(d, timeZone).date} passed before a passing draft was published, so the ${amount} hold was released${on}.`;
  } else if (d.releaseReason === "day_28") {
    why = `The hold reached its 28th day with nothing decided, so the ${amount} hold was released${on}.`;
  } else if (d.releaseReason === "fix_window_ended") {
    why = `The fix window ended with your live post still failing, so the ${amount} hold went back to ${d.brandName}${on}.`;
  } else if (d.releaseReason === "not_accepted") {
    why = `${d.brandName} didn’t accept the post within 48 hours, so the ${amount} hold went back to them${on}.`;
  } else if (d.releaseReason === "ruled_not_to_pay") {
    why = `A person at Cleared decided not to pay for this post, so the ${amount} hold went back to ${d.brandName}${on}.`;
  } else if (d.releaseReason === "hold_not_confirmed") {
    why = `PayPal couldn’t confirm ${d.brandName}’s hold before the deadline, so the ${amount} hold was released${on}.`;
  } else if (d.cancelledBy === "brand") {
    why = `${d.brandName} cancelled the deal${on}, so the ${amount} hold went back to them.`;
  } else if (d.cancelledBy === "creator") {
    why = `You cancelled the deal${on}, so the ${amount} hold went back to ${d.brandName}.`;
  } else {
    why = `The deal was cancelled${on}, so the ${amount} hold went back to ${d.brandName}.`;
  }
  return { lead: `The hold went back to ${d.brandName}.`, detail: `${why} ${end}`, action: null };
}

/** DC-FR-08, DC-FR-09, DC-FR-28: the check-failed banner: what happened, that the hold is safe, which results show. */
export interface CheckFailedBanner {
  kind: "file" | "ours";
  heading: string;
  body: string;
  hold: string;
  showing: string | null;
}

/**
 * The banner for a check that couldn't run, or null in any other state.
 *
 * @param d - the deliverable
 */
export function checkFailedBanner(d: Deliverable): CheckFailedBanner | null {
  if (d.state !== "check_failed") return null;
  const hold = `Your ${formatMoney(d.hold.amountMinor, d.hold.currency)} hold is still in place`;
  const showing = d.run ? `Below are your results from run ${d.run}.` : null;
  const f = d.checkFailure;
  if (!f) return { kind: "ours", heading: "We couldn’t check this draft", body: "", hold, showing };
  if (f.kind === "ours") {
    return {
      kind: "ours",
      heading: `Something went wrong on our side checking ${f.fileName}`,
      body: `It isn’t a problem with your video.${f.retrying ? " We’re trying again; you don’t need to do anything." : ""}`,
      hold,
      showing,
    };
  }
  return { kind: "file", heading: `We couldn’t check ${f.fileName}`, body: fileProblem(f).why, hold, showing };
}
