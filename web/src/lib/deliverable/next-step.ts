import { formatDay, formatDayTime, formatDuration, formatMoney, itemCount } from "./format";
import { deadlineView, postBy as postByText } from "./deadline";
import type { CheckFailure, Deliverable } from "./types";

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
    case "check_failed":
      return checkFailedStep(d);
    case "released":
      return releasedStep(d, timeZone);
  }
}

function resultsStep(d: Deliverable, postBy: string): NextStep {
  const toFix = d.items.filter((i) => i.status === "fix_needed" || i.status === "unsure").length;
  const waiting = d.items.filter((i) => i.status === "waiting_for_brand").length;
  const waitingText = `${itemCount(waiting)} ${waiting === 1 ? "is" : "are"} waiting for ${d.brandName}`;

  if (toFix === 0) {
    return { lead: `${waitingText}.`, detail: `You can still upload a fix yourself. ${postBy}`, action: "upload_new_draft" };
  }
  return {
    lead: `Fix ${itemCount(toFix)}, then upload a new draft.`,
    detail: waiting
      ? `${waitingText}; you can still fix ${waiting === 1 ? "it" : "them"} yourself. ${postBy}`
      : `${d.brandName}’s 48-hour review starts once every item passes.`,
    action: "upload_new_draft",
  };
}

function checkFailedStep(d: Deliverable): NextStep {
  const holdSafe = `Your ${formatMoney(d.hold.amountMinor, d.hold.currency)} hold is still in place.`;
  const f = d.checkFailure;
  if (!f) return { lead: "We couldn’t check this draft.", detail: holdSafe, action: "upload_again" };
  if (f.kind === "ours") {
    return f.retrying
      ? {
          lead: "Nothing to do right now.",
          detail: `Something went wrong on our side checking ${f.fileName}, and we’re trying again. ${holdSafe}`,
          action: null,
        }
      : {
          lead: `Something went wrong on our side checking ${f.fileName}.`,
          detail: `It isn’t a problem with your video. ${holdSafe}`,
          action: "try_again",
        };
  }
  const { lead, why } = fileProblem(f);
  return { lead, detail: `${why} ${holdSafe}`, action: "upload_again" };
}

function fileProblem(f: Extract<CheckFailure, { kind: "file" }>): { lead: string; why: string } {
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
  } else if (d.cancelledBy === "brand") {
    why = `${d.brandName} cancelled the deal${on}, so the ${amount} hold went back to them.`;
  } else if (d.cancelledBy === "creator") {
    why = `You cancelled the deal${on}, so the ${amount} hold went back to ${d.brandName}.`;
  } else {
    why = `The deal was cancelled${on}, so the ${amount} hold went back to ${d.brandName}.`;
  }
  return { lead: `The hold went back to ${d.brandName}.`, detail: `${why} ${end}`, action: null };
}
