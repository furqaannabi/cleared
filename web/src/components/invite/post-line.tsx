"use client";

import { api } from "@/lib/api";
import { formatAmount } from "@/lib/invite/amount";
import type { InviteView } from "@/lib/invite/invite-view";
import type { DealInvite } from "@/lib/invite/types";
import { AmountField } from "./amount-field";
import { ChecklistPeek } from "./checklist-peek";
import { DeadlineField } from "./deadline-field";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

/**
 * One post's line on the terms sheet: the post and its checklist count, its
 * deadline in days after the hold, and its amount. Each saves as it changes.
 *
 * @param dealId - the deal
 * @param post - the post, from the view model
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite a saved change returned
 * @param locked - the link exists, so the terms are read-only (IN-BR-03)
 * @see docs/specs/creator-invite-frd.md IN-FR-04 to IN-FR-07, IN-FR-15
 */
export function PostLine({
  dealId,
  post,
  save,
  problems,
  onInvite,
  locked,
}: {
  dealId: string;
  post: InviteView["posts"][number];
  save: Save;
  problems: SaveProblems;
  onInvite: (invite: DealInvite) => void;
  locked: boolean;
}) {
  const key = `post:${post.deliverableId}`;
  const saveTerms = (terms: { amount?: string; deadlineDays?: number }) =>
    save(key, () => api.updateInvitePost(dealId, post.deliverableId, terms), onInvite);

  return (
    <div role="group" aria-label={post.label} className="grid gap-3 border-b border-line py-4 md:grid-cols-[minmax(0,1fr)_200px_150px] md:items-start md:gap-4">
      <div>
        <b className="text-[16px]">{post.label}</b>
        <ChecklistPeek dealId={dealId} deliverableId={post.deliverableId} label={post.label} count={post.itemCount} />
      </div>
      {locked ? (
        <>
          <p className="text-[14.5px] text-ink-2 md:pt-0.5">{`Within ${post.deadlineDays} days of the hold`}</p>
          <p className="text-[17px] font-extrabold md:text-right">{post.amount && formatAmount(post.amount)}</p>
        </>
      ) : (
        <>
          <DeadlineField label={post.label} days={post.deadlineDays} exampleDate={post.exampleDate} onSave={(deadlineDays) => saveTerms({ deadlineDays })} />
          <AmountField label={post.label} amount={post.amount} problem={post.amountProblem} onSave={(amount) => saveTerms({ amount })} />
        </>
      )}
      <div className="md:col-span-3">
        <SaveProblem retry={problems[key]} />
      </div>
    </div>
  );
}
