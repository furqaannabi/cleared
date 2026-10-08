"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { creatorHoldLine } from "@/lib/brand-deal/hold-view";
import type { Note } from "@/lib/brand-deal/types";
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
 * @param brand - the brand's name
 * @param post - the post, from the view model
 * @param notes - the brand's notes about this post's amount or deadline (CH-FR-22)
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite a saved change returned
 * @param locked - the link exists, so the terms are read-only (IN-BR-03)
 * @see docs/specs/creator-invite-frd.md IN-FR-04 to IN-FR-07, IN-FR-15; docs/specs/confirm-and-hold-frd.md CH-FR-22, CH-FR-25
 */
export function PostLine({
  dealId,
  brand,
  post,
  notes = [],
  save,
  problems,
  onInvite,
  locked,
}: {
  dealId: string;
  brand: string;
  post: InviteView["posts"][number];
  notes?: Note[];
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
      {notes.map((n) => (
        <p key={n.id} className="text-[13.5px] text-ink-2 md:col-span-3">
          <b className="text-ink">{brand}:</b> <span className="whitespace-pre-wrap">“{n.text}”</span>
        </p>
      ))}
      {post.hold && <HoldLine dealId={dealId} brand={brand} post={post} />}
      <div className="md:col-span-3">
        <SaveProblem retry={problems[key]} />
      </div>
    </div>
  );
}

/** CH-FR-25: the post's hold once the brand has agreed, and its draft check when held. */
function HoldLine({ dealId, brand, post }: { dealId: string; brand: string; post: InviteView["posts"][number] }) {
  const line = creatorHoldLine(post.hold!, { brand, amount: post.amount ?? "0.00" });
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 md:col-span-3">
      <p className={`text-[14px] ${line.held ? "font-bold text-ink" : "text-ink-2"}`}>{line.text}</p>
      {line.held && (
        <Link
          href={`/deals/${encodeURIComponent(dealId)}/deliverables/${encodeURIComponent(post.deliverableId)}`}
          className="inline-flex min-h-11 items-center text-[14px] font-bold text-espresso underline underline-offset-3"
        >
          Open draft check
        </Link>
      )}
    </div>
  );
}
