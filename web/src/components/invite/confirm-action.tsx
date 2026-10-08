"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A button whose action is confirmed in place, not in a modal: pressing it
 * shows what will happen with Yes and No, and focus moves to Yes.
 *
 * @param label - the button, e.g. "Make a new link"
 * @param warning - what will happen, e.g. "The old link will stop working."
 * @param yes - the confirming button, e.g. "Yes, make a new link"
 * @param no - the cancelling button, e.g. "Keep this link"
 * @param onConfirm - runs the action
 * @see docs/specs/creator-invite-frd.md IN-FR-18, IN-FR-19
 */
export function ConfirmAction({ label, warning, yes, no, onConfirm }: { label: string; warning: string; yes: string; no: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) yesRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center text-[14px] font-bold text-espresso underline underline-offset-3">
        {label}
      </button>
    );
  }
  return (
    <div className="grid gap-2 rounded-md bg-latte-wash p-3">
      <p className="text-[14px] font-semibold text-ink">{warning}</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={yesRef}
          type="button"
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
          className="inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover"
        >
          {yes}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-pill px-3 font-bold text-espresso">
          {no}
        </button>
      </div>
    </div>
  );
}
