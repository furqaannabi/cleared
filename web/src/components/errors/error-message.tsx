"use client";

import { useEffect, useRef } from "react";
import { CONTACT_EMAIL } from "@/lib/legal/contact";

const BUTTON = "inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover";

/**
 * "Something went wrong on this page": what happened, what to do (Try again
 * or Reload, and the email), and the digest as a reference when Next gives
 * one. The error's message and stack are never shown. Focus moves to the
 * heading so the change is announced.
 *
 * @param error - the error; only its digest is read
 * @param retry - re-renders the broken part (Next's retry), or reloads
 * @param action - the button's words
 * @see docs/specs/error-pages-frd.md EP-FR-03 to EP-FR-06, EP-BR-01
 */
export function ErrorMessage({ error, retry, action = "Try again" }: { error: Error & { digest?: string }; retry: () => void; action?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 ref={heading} tabIndex={-1} className="font-head text-page-title-phone font-bold tracking-[-0.01em] focus:outline-none">
        Something went wrong on this page
      </h1>
      <p className="mt-2 text-ink-2">
        Try again. If it keeps happening, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-espresso underline underline-offset-3">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <button type="button" onClick={retry} className={`mt-5 ${BUTTON}`}>
        {action}
      </button>
      {error.digest && <p className="mt-4 text-label text-ink-3 select-all">Reference: {error.digest}</p>}
    </section>
  );
}
