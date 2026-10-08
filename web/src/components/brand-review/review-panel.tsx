"use client";

import { formatDayTime } from "@/lib/deliverable/format";
import { formatAmount } from "@/lib/invite/amount";
import type { BrandReviewView } from "@/lib/brand-review/review-view";
import type { BrandDeliverable } from "@/lib/brand-review/types";
import { useId, useState } from "react";
import { FIELD, GHOST, OUTLINE, PRIMARY } from "./styles";
import type { ReviewActions } from "./use-review-actions";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * "Your review": what happens next on this post and the brand's answer. In
 * the window: the time left, the saved objections, Send and Approve, each
 * confirmed in place. After objecting: the objections and "Approve this
 * draft anyway". Beside the work from `lg:`; first on phones.
 *
 * @param post - the post as the brand sees it
 * @param view - its review view
 * @param actions - the brand's answers on this post
 * @param timeZone - the viewer's timezone, for times
 * @see docs/specs/brand-review-frd.md RW-FR-11, RW-FR-15 to RW-FR-22
 */
export function ReviewPanel({ post, view, actions, timeZone }: { post: BrandDeliverable; view: BrandReviewView; actions: ReviewActions; timeZone?: string }) {
  const c = post.creatorName;
  const nameOf = (id: string) => view.items.find((i) => i.id === id)?.name ?? "An item";
  const n = actions.objections.length;
  const amount = formatAmount(post.hold.amount);
  return (
    <section id="your-review" aria-label="Your review" className="grid scroll-mt-4 content-start gap-3 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 className="font-head text-[18px] font-bold">Your review</h2>
      {actions.unsent && post.review.state === "approved" && (
        <div role="alert" className="grid gap-2 rounded-md border border-latte-line bg-latte-wash p-3.5 text-[14px]">
          <p>
            The review window ended at {formatDayTime(post.review.approvedAt, timeZone)}, so this draft is approved. Your objections weren’t sent.
          </p>
          {actions.unsent.map((o) => (
            <p key={o.itemId} className="text-ink-2">
              <b className="text-ink">{nameOf(o.itemId)}:</b> <span className="whitespace-pre-wrap">{o.note}</span>
            </p>
          ))}
        </div>
      )}
      {view.timeLeft && (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <b className="font-head text-[28px] font-extrabold tabular-nums">{view.timeLeft.text}</b>
          <span className="text-[14px] text-ink-2">left</span>
        </p>
      )}
      {view.warning && <p className="text-[14px] font-extrabold text-fail">{view.warning}</p>}
      <div aria-live="polite" className="grid gap-1">
        <p className="text-[15px] font-bold">{view.next.lead}</p>
        <p className="text-[14px] text-ink-2">{view.next.detail}</p>
      </div>

      {view.state === "objected" &&
        view.items
          .filter((i) => i.status.value === "objected")
          .map((i) => <Saved key={i.id} name={i.name} note={i.note ?? ""} />)}
      {view.actions.object && actions.objections.map((o) => <Saved key={o.itemId} name={nameOf(o.itemId)} note={o.note} />)}
      {view.actions.object && actions.editing && n === 0 && <p className="text-meta text-ink-3">Writing an objection…</p>}

      {actions.problem && (
        <p role="alert" className="text-meta font-bold text-fail">
          {actions.problem}
        </p>
      )}

      {actions.confirming === "send" ? (
        <Confirm
          busy={actions.busy}
          yes="Yes, send"
          onYes={actions.send}
          onNo={() => actions.confirm(null)}
          text={
            <>
              <b>Send {plural(n, "objection")}?</b> The clock stops and {c} makes a new draft. You can still approve this draft until {c} sends one.
            </>
          }
        />
      ) : actions.confirming === "confirm_post" || actions.confirming === "accept_post" ? (
        <Confirm
          busy={actions.busy}
          yes={actions.confirming === "confirm_post" ? "Yes, confirm" : "Yes, accept"}
          onYes={actions.confirming === "confirm_post" ? actions.confirmPost : actions.acceptPost}
          onNo={() => actions.confirm(null)}
          text={
            <>
              <b>{actions.confirming === "confirm_post" ? "Confirm?" : "Accept?"}</b> Your {amount} is taken and {c} is paid.
            </>
          }
        />
      ) : actions.objecting ? (
        <ObjectField actions={actions} />
      ) : actions.confirming === "approve" ? (
        <Confirm
          busy={actions.busy}
          yes="Yes, approve"
          onYes={actions.approve}
          onNo={() => actions.confirm(null)}
          text={
            <>
              <b>Approve this draft?</b> {c} can then post it. Your {amount} is taken only once the live post checks out.
            </>
          }
        />
      ) : (
        <>
          {view.actions.object && n > 0 && (
            <button type="button" onClick={() => actions.confirm("send")} className={PRIMARY}>
              Send {plural(n, "objection")} to {c}
            </button>
          )}
          {view.actions.approve && (
            <button type="button" onClick={() => actions.confirm("approve")} className={n > 0 ? OUTLINE : PRIMARY}>
              Approve draft
            </button>
          )}
          {view.actions.confirmPost && (
            <>
              <button type="button" onClick={() => actions.confirm("confirm_post")} className={PRIMARY}>
                Confirm the post
              </button>
              <button type="button" onClick={() => actions.openObjection(true)} className={OUTLINE}>
                Object
              </button>
            </>
          )}
          {view.actions.acceptPost && (
            <button type="button" onClick={() => actions.confirm("accept_post")} className={OUTLINE}>
              Accept the post anyway
            </button>
          )}
          {view.actions.approveAnyway && (
            <button type="button" onClick={() => actions.confirm("approve")} className={OUTLINE}>
              Approve this draft anyway
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** PP-FR-27: an objection to a live post needs a reason; plain text, at most 500 characters. */
function ObjectField({ actions }: { actions: ReviewActions }) {
  const [text, setText] = useState("");
  const id = useId();
  return (
    <div className="grid gap-2 rounded-md border border-latte-line bg-surface p-3">
      <label htmlFor={id} className="text-[13.5px] font-bold">
        Why are you objecting?
      </label>
      <textarea id={id} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} />
      {actions.objectProblem && (
        <p role="alert" className="text-meta font-bold text-fail">
          {actions.objectProblem}
        </p>
      )}
      <p className="text-meta text-ink-3">A person at Cleared will decide. Your money stays held until then.</p>
      <span className="flex flex-wrap gap-2">
        <button type="button" disabled={actions.busy} onClick={() => actions.objectToPost(text)} className={OUTLINE}>
          Send objection
        </button>
        <button type="button" onClick={() => actions.openObjection(false)} className={GHOST}>
          Cancel
        </button>
      </span>
    </div>
  );
}

function Saved({ name, note }: { name: string; note: string }) {
  return (
    <p className="rounded-sm bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
      <b className="text-ink">{name}:</b> <span className="whitespace-pre-wrap">{note}</span>
    </p>
  );
}

function Confirm({ text, yes, busy, onYes, onNo }: { text: React.ReactNode; yes: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="grid gap-2.5 rounded-[14px] border border-latte-line bg-latte-wash p-3.5">
      <p className="text-[14.5px]">{text}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onYes} className={`${PRIMARY} min-h-11 px-[18px] text-[14.5px]`}>
          {yes}
        </button>
        <button type="button" onClick={onNo} className={GHOST}>
          Not yet
        </button>
      </div>
    </div>
  );
}
