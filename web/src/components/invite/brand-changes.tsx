"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { noteTarget } from "@/lib/brand-deal/terms-view";
import type { Note } from "@/lib/brand-deal/types";
import type { DealDraft } from "@/lib/checklist-builder/types";
import type { DealInvite } from "@/lib/invite/types";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

/**
 * "{brand} asked for {n} changes": each of the brand's notes with what it's
 * about, and the creator's optional reply. Notes about the deal as a whole
 * come first. Notes are the brand's plain text, never acted on.
 *
 * @param invite - the deal's invite, with its notes
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite a saved reply returned
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-22, CH-FR-23, CH-BR-07
 */
export function BrandChanges({ invite, save, problems, onInvite }: { invite: DealInvite; save: Save; problems: SaveProblems; onInvite: (invite: DealInvite) => void }) {
  const draft = useDraft(invite.dealId);
  const notes = [...(invite.notes ?? []).filter((n) => n.version === invite.version)].sort((a, b) => Number(b.about.kind === "deal") - Number(a.about.kind === "deal"));
  const target = (n: Note) =>
    draft
      ? noteTarget({ posts: draft.deliverables.map((d) => ({ deliverableId: d.id, platform: d.platform })), items: draft.items, brief: draft.brief?.lines ?? [] }, n.about)
      : "…";
  const count = `${notes.length} ${notes.length === 1 ? "change" : "changes"}`;
  return (
    <section aria-labelledby="changes-heading" className="mt-6 grid gap-3 rounded-[18px] border border-latte-line bg-surface p-[18px] md:p-6">
      <h2 id="changes-heading" className="font-head text-[20px] font-extrabold">
        {invite.brandName} asked for {count}
      </h2>
      <p className="text-[14.5px] text-ink-2">
        Change the terms or the checklist, reply if you like, then send the updated terms. {invite.brandName}’s link stays the same.
      </p>
      <ul className="grid">
        {notes.map((n) => (
          <li key={n.id} className="grid gap-1 border-t border-line-soft py-3 first:border-t-0">
            <p className="text-meta font-bold text-ink-3">{target(n)}</p>
            <p className="text-[15px] whitespace-pre-wrap">{n.text}</p>
            <Reply note={n} target={target(n)} onSave={(reply) => save(`reply:${n.id}`, () => api.replyToNote(invite.dealId, n.id, reply), onInvite)} />
            <SaveProblem retry={problems[`reply:${n.id}`]} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The deal's draft, for the items and brief lines the notes are about. */
function useDraft(dealId: string) {
  const [draft, setDraft] = useState<DealDraft | null>(null);
  useEffect(() => {
    let live = true;
    api.getDealDraft(dealId).then((r) => live && r.ok && setDraft(r.data));
    return () => {
      live = false;
    };
  }, [dealId]);
  return draft;
}

const LINK = "inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3";

function Reply({ note, target, onSave }: { note: Note; target: string; onSave: (reply: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.reply ?? "");
  const id = `reply-${note.id}`;
  if (!editing)
    return note.reply ? (
      <div className="rounded-sm bg-latte-wash px-3 py-2 text-[13.5px] text-ink-2">
        <b className="text-ink">Your reply:</b> <span className="whitespace-pre-wrap">{note.reply}</span>
        <div>
          <button type="button" aria-label={`Edit your reply about ${target}`} onClick={() => setEditing(true)} className={LINK}>
            Edit
          </button>
        </div>
      </div>
    ) : (
      <button type="button" aria-label={`Reply about ${target}`} onClick={() => setEditing(true)} className={`${LINK} -my-1.5 justify-self-start`}>
        Reply
      </button>
    );
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[13.5px] font-bold">
        Your reply about {target}
      </label>
      <textarea
        id={id}
        maxLength={500}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="block w-full rounded-sm border border-latte-line px-3 py-2.5 text-[16px] leading-[1.45] focus-visible:border-espresso"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta text-ink-3">{text.length} of 500</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 items-center rounded-pill px-3 text-[14.5px] font-bold text-espresso">
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={async () => {
              if (await onSave(text.trim())) setEditing(false);
            }}
            className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso disabled:opacity-50"
          >
            Save reply
          </button>
        </span>
      </div>
    </div>
  );
}
