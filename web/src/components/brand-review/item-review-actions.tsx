"use client";

import { useEffect, useId, useRef, useState } from "react";
import { canObject } from "@/lib/brand-review/objection-draft";
import type { BrandReviewView } from "@/lib/brand-review/review-view";
import { FIELD, GHOST, OUTLINE, PRIMARY, TEXT_LINK } from "./styles";
import type { ReviewActions } from "./use-review-actions";

const MAX = 500;
type Item = BrandReviewView["items"][number];

/**
 * What the brand can do about one item, in its open card (phones) or the
 * evidence panel (tablet and up): answer an ask (RW-FR-12 to RW-FR-14),
 * object in the window (RW-FR-17), or read the note it already sent.
 *
 * @param item - the item, with its status for the brand
 * @param view - the post's review view, for which actions are on
 * @param creator - the creator, named on buttons
 * @param actions - the brand's answers on this post
 * @see docs/specs/brand-review-frd.md RW-FR-12 to RW-FR-17
 */
export function ItemReviewActions({ item, view, creator, actions }: { item: Item; view: BrandReviewView; creator: string; actions: ReviewActions }) {
  const [fixing, setFixing] = useState(false);
  const status = item.status.value;
  if (item.note && (status === "objected" || status === "fix_requested"))
    return (
      <p className="rounded-sm bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
        <b className="text-ink">Your note:</b> <span className="whitespace-pre-wrap">{item.note}</span>
      </p>
    );
  if (view.actions.answer && status === "asked") {
    if (fixing)
      return (
        <NoteField
          label={`A note for ${creator} (optional)`}
          saveLabel={`Send to ${creator}`}
          required={false}
          busy={actions.busy}
          onCancel={() => setFixing(false)}
          onSave={(note) => actions.askToFix(item.id, note)}
        />
      );
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={actions.busy} onClick={() => actions.accept(item.id)} className={`${PRIMARY} min-h-11 px-[18px] text-[14.5px]`}>
          Accept
        </button>
        <button type="button" onClick={() => setFixing(true)} className={OUTLINE}>
          Ask {creator} to fix it
        </button>
      </div>
    );
  }
  if (!view.actions.object || !canObject({ ...item, status })) return null;
  const saved = actions.objections.find((o) => o.itemId === item.id);
  if (actions.editing === item.id)
    return (
      <NoteField
        label={`What’s wrong with ${item.name}?`}
        saveLabel="Save objection"
        initial={saved?.note}
        required
        problem={actions.editProblem}
        onCancel={() => actions.edit(null)}
        onSave={(note) => actions.save(item.id, note)}
      />
    );
  if (saved)
    return (
      <div className="rounded-sm bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
        <b className="text-ink">Your objection:</b> <span className="whitespace-pre-wrap">{saved.note}</span>
        <div className="flex gap-4">
          <button type="button" aria-label={`Edit your objection to ${item.name}`} onClick={() => actions.edit(item.id)} className={TEXT_LINK}>
            Edit
          </button>
          <button type="button" aria-label={`Remove your objection to ${item.name}`} onClick={() => actions.remove(item.id)} className={TEXT_LINK}>
            Remove
          </button>
        </div>
      </div>
    );
  return (
    <button type="button" aria-label={`Object to ${item.name}`} onClick={() => actions.edit(item.id)} className={`${TEXT_LINK} -my-1.5`}>
      Object
    </button>
  );
}

function NoteField(props: {
  label: string;
  saveLabel: string;
  initial?: string;
  required: boolean;
  problem?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onSave: (note: string) => void;
}) {
  const [text, setText] = useState(props.initial ?? "");
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // The field opens because the brand asked for it, so it takes focus.
  useEffect(() => field.current?.focus(), []);
  return (
    <div className="rounded-md border border-latte-line bg-surface p-3">
      <label htmlFor={id} className="mb-1.5 block text-[13.5px] font-bold">
        {props.label}
      </label>
      <textarea id={id} ref={field} maxLength={MAX} rows={3} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} />
      {props.problem && (
        <p role="alert" className="text-meta font-bold text-fail">
          {props.problem}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta text-ink-3" aria-live="polite">
          {text.length} of {MAX}
          {props.required ? " · required" : ""}
        </span>
        <span className="flex gap-2">
          <button type="button" onClick={props.onCancel} className={GHOST}>
            Cancel
          </button>
          <button type="button" disabled={props.busy} onClick={() => props.onSave(text)} className={OUTLINE}>
            {props.saveLabel}
          </button>
        </span>
      </div>
    </div>
  );
}
