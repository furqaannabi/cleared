"use client";

import { useId, useState } from "react";
import { api } from "@/lib/api";
import type { DealDraft } from "@/lib/checklist-builder/types";

const MIN = 40;
const MAX = 20_000;

/**
 * BC-FR-04, BC-FR-05: paste the brief the brand sent. Too short or too long is
 * said before sending. File upload waits on the backend (BC-FR-06), so the
 * page offers pasting only.
 *
 * @param draft - the deal draft (for its id and brand)
 * @param onSent - called with the draft the API returns (reading has started)
 * @param initial - text to start with, e.g. after a failed reading
 */
export function BriefForm({ draft, onSent, initial = "" }: { draft: DealDraft; onSent: (d: DealDraft) => void; initial?: string }) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < MIN) return setProblem("This looks too short to be a brief. Paste the whole thing.");
    if (text.length > MAX) return setProblem("Briefs can be up to 20,000 characters, about 8 pages.");
    setProblem(null);
    setSending(true);
    const r = await api.submitBrief(draft.id, text);
    setSending(false);
    if (r.ok) onSent(r.data);
    else setProblem("We couldn’t send the brief. Try again.");
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-3">
      <label htmlFor={id} className="text-body-strong font-bold">
        Paste the brief {draft.brandName} sent
      </label>
      <p className="-mt-1 text-meta text-ink-3">
        The AI turns it into a checklist for each post, cites the line each item came from, and asks about anything vague.
      </p>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-count${problem ? ` ${id}-err` : ""}`}
        className="min-h-60 rounded-md border border-line bg-surface p-3.5 text-body-strong leading-relaxed aria-invalid:border-fail"
      />
      <p id={`${id}-count`} className="text-label text-ink-3">
        {text.length.toLocaleString("en-US")} of 20,000 characters
      </p>
      {problem && (
        <p id={`${id}-err`} role="alert" className="text-meta font-semibold text-fail">
          {problem}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        aria-busy={sending || undefined}
        className="inline-flex min-h-12 items-center justify-center justify-self-start rounded-pill bg-espresso px-6 text-body-strong font-bold text-surface hover:bg-espresso-hover disabled:opacity-70"
      >
        Make the checklist
      </button>
    </form>
  );
}
