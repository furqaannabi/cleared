"use client";

import { useId, useState } from "react";
import { looksLikeEmail } from "@/lib/email/looks-like-email";
import { useNotes } from "./notes";

/**
 * Agree: the one-line summary of what the brand is agreeing to, the brand's
 * own optional email for anything after the post is live, and "Agree to
 * these terms". With notes not yet sent the button asks "Agree
 * without sending your {n} notes?". Fixed to the bottom of the screen on
 * phones, so it's always in reach.
 *
 * @param summary - the summary line, from the terms view
 * @param agreeing - whether the agreement is being sent
 * @param problem - why the last try didn't go through, if it didn't
 * @param creator - the creator's name, for the email's line
 * @param onAgree - agrees to the version shown, with the brand's email if given
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-14, CH-FR-15, CH-FR-26
 */
export function AgreePanel({
  summary,
  creator,
  agreeing,
  problem,
  onAgree,
}: {
  summary: string;
  creator: string;
  agreeing: boolean;
  problem: string | null;
  onAgree: (email?: string) => void;
}) {
  const { drafts } = useNotes();
  const n = drafts.length;
  const id = useId();
  const [email, setEmail] = useState("");
  const [emailProblem, setEmailProblem] = useState<string | null>(null);
  // CH-FR-28: optional; when given it must look like an email before agreeing.
  const agree = () => {
    const typed = email.trim();
    if (typed && !looksLikeEmail(typed)) return setEmailProblem("Enter an email, like name@example.com");
    setEmailProblem(null);
    onAgree(typed || undefined);
  };
  return (
    <section
      aria-label="Agree"
      className="fixed inset-x-3 bottom-3 z-10 grid gap-2.5 rounded-[16px] bg-surface p-3.5 shadow-floating-bar lg:static lg:rounded-[18px] lg:border lg:border-line lg:p-[18px] lg:shadow-none"
    >
      <p className="text-[13.5px] text-ink-2 lg:text-[14.5px]">{summary}</p>
      <div>
        <label htmlFor={id} className="mb-1 block text-[13.5px] font-bold">
          Your email (optional)
        </label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailProblem ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={`min-h-11 w-full rounded-md border bg-surface px-3 text-[16px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso ${emailProblem ? "border-fail ring-1 ring-fail" : "border-latte-line"}`}
        />
        <p id={`${id}-hint`} className="mt-1 text-[12.5px] text-ink-3">
          {emailProblem && <b className="block text-fail">{emailProblem}</b>}
          {`We’ll only email you if ${creator}’s post needs your answer after it’s live. ${creator} won’t see it.`}
        </p>
      </div>
      {problem && (
        <p role="alert" className="text-meta font-bold text-fail">
          {problem}
        </p>
      )}
      <button
        type="button"
        disabled={agreeing}
        onClick={agree}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-espresso px-[22px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover disabled:opacity-60"
      >
        {n > 0 ? `Agree without sending your ${n} ${n === 1 ? "note" : "notes"}?` : "Agree to these terms"}
      </button>
    </section>
  );
}
