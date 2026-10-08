"use client";

import { useId, useState } from "react";
import { formatAmount, parseAmount } from "@/lib/invite/amount";

/**
 * One post's amount in US dollars. Checked as typed text when the field is
 * left (never through a float); a valid, changed amount is handed to `onSave`
 * as a two-place decimal string.
 *
 * @param label - the post, e.g. "YouTube video", for the field's name
 * @param amount - the saved amount, e.g. "1200.00"
 * @param problem - the API's reason it turned the amount down, if any (IN-FR-06)
 * @param onSave - saves the amount
 * @see docs/specs/creator-invite-frd.md IN-FR-05, IN-FR-06
 */
export function AmountField({ label, amount, problem, onSave }: { label: string; amount?: string; problem?: string; onSave: (amount: string) => void }) {
  const shown = amount ? formatAmount(amount).slice(1) : "";
  const [text, setText] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const message = error ?? problem ?? null;

  function leave() {
    if (text.trim() === "" && !amount) return setError(null);
    const parsed = parseAmount(text);
    if (!parsed.ok) return setError(parsed.message);
    setError(null);
    setText(formatAmount(parsed.value).slice(1));
    if (parsed.value !== amount) onSave(parsed.value);
  }

  return (
    <div>
      <label htmlFor={id} aria-hidden="true" className="mb-1.5 block text-[13px] font-bold text-ink-3 md:sr-only">
        Amount
      </label>
      <div
        className={`flex min-h-12 items-center gap-1.5 rounded-md border bg-surface px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-espresso ${message ? "border-fail ring-1 ring-fail" : "border-latte-line"}`}
      >
        <span aria-hidden="true" className="font-bold text-ink-3">
          $
        </span>
        <input
          id={id}
          aria-label={`Amount for the ${label}`}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={leave}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          className="w-full min-w-0 bg-transparent text-right text-[17px] font-bold outline-none"
        />
      </div>
      {message && (
        <p id={`${id}-error`} className="mt-1.5 text-meta font-bold text-fail">
          {message}
        </p>
      )}
    </div>
  );
}
