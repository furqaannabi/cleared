"use client";

import type { ReactNode } from "react";

const PRIMARY =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-espresso px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover disabled:opacity-60";
const GHOST = "inline-flex min-h-11 items-center rounded-pill px-3 text-[14.5px] font-bold text-espresso";

/**
 * The send bar: the brand's unsent notes, pinned to the bottom of the screen
 * at every width. Fixed above the page on phones; from `lg:` it sticks to the
 * bottom of the column it is placed in. It shows how many notes there are,
 * what they're about on one line, and Send; Send turns the same card into the
 * confirmation, listing each note. No business logic: the caller words it and
 * sends.
 *
 * @param label - the region's name ("Your unsent objections")
 * @param summary - "2 objections for Ada"
 * @param notes - each note: what it's about, and the note
 * @param sendLabel - "Send to Ada"
 * @param confirming - whether the confirmation is open
 * @param question - the confirmation's question, in bold
 * @param detail - what sending does, after the question
 * @param busy - whether the notes are being sent
 * @param problem - why the last send failed, if it did
 * @param onOpen - Send was pressed
 * @param onCancel - "Not yet"
 * @param onYes - "Yes, send"
 * @see docs/specs/brand-review-frd.md RW-FR-17, RW-FR-18 (1.3)
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-11 (1.10)
 */
export function SendBar(props: {
  label: string;
  summary: string;
  notes: { key: string; about: string; note: string }[];
  sendLabel: string;
  confirming: boolean;
  question: string;
  detail: ReactNode;
  busy: boolean;
  problem?: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onYes: () => void;
}) {
  return (
    <section
      aria-label={props.label}
      className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-[minmax(0,1fr)] gap-2.5 rounded-[16px] bg-surface p-3.5 shadow-floating-bar lg:sticky lg:inset-x-auto lg:bottom-6 lg:px-4"
    >
      {props.confirming ? (
        <>
          <p className="text-[14.5px] text-ink-2">
            <b className="block font-head text-[18px] font-extrabold text-ink">{props.question}</b>
            {props.detail}
          </p>
          <ul className="grid max-h-[40vh] gap-1.5 overflow-auto rounded-sm bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
            {props.notes.map((n) => (
              <li key={n.key}>
                <b className="text-ink">{n.about}:</b> <span className="whitespace-pre-wrap">{n.note}</span>
              </li>
            ))}
          </ul>
          {props.problem && (
            <p role="alert" className="text-meta font-bold text-fail">
              {props.problem}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={props.busy} onClick={props.onYes} className={PRIMARY}>
              Yes, send
            </button>
            <button type="button" onClick={props.onCancel} className={GHOST}>
              Not yet
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p aria-live="polite" className="text-[15px] font-bold">
                {props.summary}
              </p>
              <p className="truncate text-[13px] text-ink-2">{props.notes.map((n) => n.about).join(" · ")}</p>
            </div>
            <button type="button" disabled={props.busy} onClick={props.onOpen} className={PRIMARY}>
              {props.sendLabel}
            </button>
          </div>
          {props.problem && (
            <p role="alert" className="text-meta font-bold text-fail">
              {props.problem}
            </p>
          )}
        </>
      )}
    </section>
  );
}
