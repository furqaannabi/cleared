"use client";

import { useId, useState } from "react";

const MAX_DAYS = 21;

/** Why typed days can't be used, or null when they can. */
function problemWith(text: string): string | null {
  if (!/^\d+$/.test(text.trim())) return "Enter a number of days, from 1 to 21.";
  const n = Number(text);
  if (n < 1) return "At least 1 day.";
  if (n > MAX_DAYS) return "Up to 21 days. PayPal only holds money for 29 days, so Cleared keeps a margin.";
  return null;
}

/**
 * One post's deadline as a number of days after the brand approves the hold,
 * 1 to 21, typed or stepped with − / +, and an example date for if the brand
 * approved today.
 *
 * @param label - the post, e.g. "YouTube video", for the controls' names
 * @param days - the saved number of days
 * @param exampleDate - e.g. "22 Oct", or null without a deadline
 * @param onSave - saves a new number of days
 * @see docs/specs/creator-invite-frd.md IN-FR-07, IN-BR-01
 */
export function DeadlineField({ label, days, exampleDate, onSave }: { label: string; days?: number; exampleDate: string | null; onSave: (days: number) => void }) {
  const [text, setText] = useState(days ? String(days) : "");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const current = /^\d+$/.test(text) ? Number(text) : null;

  function commit(next: number) {
    setText(String(next));
    setError(null);
    if (next !== days) onSave(next);
  }
  function leave() {
    if (text.trim() === "" && !days) return setError(null);
    const problem = problemWith(text);
    if (problem) return setError(problem);
    commit(Number(text));
  }

  const step = "grid size-12 place-items-center text-[22px] font-semibold text-espresso disabled:text-ink-4 disabled:opacity-50";
  return (
    <div>
      <p aria-hidden="true" className="mb-1.5 text-[13px] font-bold text-ink-3 md:sr-only">
        Days after the hold
      </p>
      <div className={`inline-flex items-center overflow-hidden rounded-md border bg-surface ${error ? "border-fail ring-1 ring-fail" : "border-latte-line"}`}>
        <button type="button" aria-label={`One day fewer for the ${label}`} disabled={!current || current <= 1} onClick={() => current && commit(Math.min(current - 1, MAX_DAYS))} className={step}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DAYS}
          aria-label={`Days after the hold for the ${label}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={leave}
          className="h-12 w-12 border-x border-line-soft bg-transparent text-center text-[17px] font-extrabold outline-none [appearance:textfield] focus-visible:bg-latte-wash [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label={`One day more for the ${label}`} disabled={current !== null && current >= MAX_DAYS} onClick={() => commit(current ? Math.min(current + 1, MAX_DAYS) : 1)} className={step}>
          +
        </button>
      </div>
      {exampleDate && <p className="mt-1.5 text-meta whitespace-nowrap text-ink-3">{`${exampleDate} if approved today`}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-meta font-bold text-fail">
          {error}
        </p>
      )}
    </div>
  );
}
