"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/brand-deal/types";
import { noteKey, useNotes } from "./notes";

const MAX = 500;
const TEXT_LINK = "inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3";

/**
 * "Ask for a change" on one thing the brand is agreeing to. It opens a note
 * field in place (plain text, up to 500 characters); a saved note shows
 * beside the thing with Edit and Remove. Shows nothing once notes can't be written.
 *
 * @param about - what the note is about
 * @param target - what it's about, in words, for names ("Says the code MOSS10")
 * @param label - the button's visible text (default "Ask for a change")
 * @param name - the button's full name, when the label alone doesn't say what it's about
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-10, CH-FR-11, CH-FR-27
 */
export function AskForChange({ about, target, label = "Ask for a change", name }: { about: Note["about"]; target: string; label?: string; name?: string }) {
  const { editable, drafts, editing, setEditing, save, remove } = useNotes();
  const key = noteKey(about);
  const saved = drafts.find((n) => n.key === key);
  if (!editable) return null;
  if (editing === key) return <NoteField initial={saved?.text ?? ""} target={target} onCancel={() => setEditing(null)} onSave={(text) => save({ key, about, target, text })} />;
  if (saved)
    return (
      <div className="mt-1.5 rounded-sm bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
        <b className="text-ink">Your note:</b> <span className="whitespace-pre-wrap">{saved.text}</span>
        <div className="flex gap-4">
          <button type="button" aria-label={`Edit your note about ${target}`} onClick={() => setEditing(key)} className={TEXT_LINK}>
            Edit
          </button>
          <button type="button" aria-label={`Remove your note about ${target}`} onClick={() => remove(key)} className={TEXT_LINK}>
            Remove
          </button>
        </div>
      </div>
    );
  return (
    <button type="button" aria-label={name ?? (label === "Ask for a change" ? `Ask for a change to ${target}` : undefined)} onClick={() => setEditing(key)} className={`${TEXT_LINK} -my-1.5 justify-self-start`}>
      {label}
    </button>
  );
}

function NoteField({ initial, target, onCancel, onSave }: { initial: string; target: string; onCancel: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const field = useRef<HTMLTextAreaElement>(null);
  // The field opens because the brand asked for it, so it takes focus.
  useEffect(() => field.current?.focus(), []);
  const id = `note-${target.replace(/\W+/g, "-")}`;
  return (
    <div className="mt-1.5 rounded-md border border-latte-line bg-surface p-3">
      <label htmlFor={id} className="mb-1.5 block text-[13.5px] font-bold">
        Your note about {target}
      </label>
      <textarea
        id={id}
        ref={field}
        maxLength={MAX}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="block w-full rounded-sm border border-latte-line px-3 py-2.5 text-[16px] leading-[1.45] focus-visible:border-espresso"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta text-ink-3" aria-live="polite">
          {text.length} of {MAX}
        </span>
        <span className="flex gap-2">
          <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-pill px-3 text-[14.5px] font-bold text-espresso">
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => onSave(text.trim())}
            className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso disabled:opacity-50"
          >
            Save note
          </button>
        </span>
      </div>
    </div>
  );
}
