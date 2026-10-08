"use client";

import { useNotes } from "./notes";

/**
 * Agree: the one-line summary of what the brand is agreeing to, above
 * "Agree to these terms". With notes not yet sent the button asks "Agree
 * without sending your {n} notes?". Fixed to the bottom of the screen on
 * phones, so it's always in reach.
 *
 * @param summary - the summary line, from the terms view
 * @param agreeing - whether the agreement is being sent
 * @param problem - why the last try didn't go through, if it didn't
 * @param onAgree - agrees to the version shown
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-14, CH-FR-15, CH-FR-26
 */
export function AgreePanel({ summary, agreeing, problem, onAgree }: { summary: string; agreeing: boolean; problem: string | null; onAgree: () => void }) {
  const { drafts } = useNotes();
  const n = drafts.length;
  return (
    <section
      aria-label="Agree"
      className="fixed inset-x-3 bottom-3 z-10 grid gap-2.5 rounded-[16px] bg-surface p-3.5 shadow-floating-bar lg:static lg:rounded-[18px] lg:border lg:border-line lg:p-[18px] lg:shadow-none"
    >
      <p className="text-[13.5px] text-ink-2 lg:text-[14.5px]">{summary}</p>
      {problem && (
        <p role="alert" className="text-meta font-bold text-fail">
          {problem}
        </p>
      )}
      <button
        type="button"
        disabled={agreeing}
        onClick={onAgree}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-espresso px-[22px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover disabled:opacity-60"
      >
        {n > 0 ? `Agree without sending your ${n} ${n === 1 ? "note" : "notes"}?` : "Agree to these terms"}
      </button>
    </section>
  );
}
