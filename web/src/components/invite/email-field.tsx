"use client";

import { useId, useState } from "react";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An email field that checks its shape and saves when left. An optional field
 * can be emptied, which saves null.
 *
 * @param label - the field's visible name
 * @param value - the saved email
 * @param hint - a line under the field, part of its description
 * @param optional - whether the field may be left empty
 * @param onSave - saves the new email, or null when an optional field is emptied
 * @see docs/specs/creator-invite-frd.md IN-FR-12, IN-FR-13
 */
export function EmailField({
  label,
  value,
  hint,
  optional = false,
  onSave,
}: {
  label: string;
  value?: string;
  hint: string;
  optional?: boolean;
  onSave: (email: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  function leave() {
    const email = text.trim();
    if (!email) {
      if (!optional) return setError("Add your PayPal email");
      setError(null);
      if (value) onSave(null);
      return;
    }
    if (email.length > 254 || !EMAIL.test(email)) return setError("Enter an email, like name@example.com");
    setError(null);
    if (email !== value) onSave(email);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-body-strong font-bold">
        {label}
      </label>
      <input
        id={id}
        type="email"
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={leave}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={`min-h-12 w-full rounded-md border bg-surface px-3.5 text-[16px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso ${error ? "border-fail ring-1 ring-fail" : "border-latte-line"}`}
      />
      <p id={`${id}-hint`} className="mt-1.5 text-meta text-ink-3">
        {error && <b className="block text-fail">{error}</b>}
        {hint}
      </p>
    </div>
  );
}
