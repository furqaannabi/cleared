"use client";

import { useId, useState } from "react";
import { Seal } from "@/components/ui/seal";
import { api } from "@/lib/api";
import type { DealDraft, Question } from "@/lib/checklist-builder/types";
import type { Save } from "./checklist-builder";

/**
 * BC-FR-13: the AI's questions about vague brief lines, first, with its
 * suggested answers, "Something else" (own words) and "Leave it out".
 */
export function QuestionsPanel({ draft, questions, save }: { draft: DealDraft; questions: Question[]; save: Save }) {
  const n = questions.length;
  return (
    <section aria-labelledby="questions-heading" className="grid gap-2.5">
      <h2 id="questions-heading" className="font-head text-item-title font-bold">
        {n} {n === 1 ? "question" : "questions"} to answer
      </h2>
      {questions.map((q) => (
        <QuestionCard key={q.id} dealId={draft.id} q={q} save={save} />
      ))}
    </section>
  );
}

function QuestionCard({ dealId, q, save }: { dealId: string; q: Question; save: Save }) {
  const id = useId();
  const [own, setOwn] = useState<string | null>(null);
  const answer = (kind: "suggestion" | "own_words" | "left_out", text?: string) => save(() => api.answerQuestion(dealId, q.id, { kind, text }), q.id);
  const opt = "inline-flex min-h-11 items-center rounded-pill px-4 text-[14px] font-bold";
  return (
    <div className="grid grid-cols-[26px_1fr] gap-3 rounded-md border border-line bg-surface p-3.5">
      <Seal fillClassName="fill-unsure-wash" className="size-[26px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true" className="size-full text-unsure">
          <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
        </svg>
      </Seal>
      <div>
        <p className="font-bold">
          <span className="text-ink-3">Line {q.briefLine}: </span>
          {q.text}
        </p>
        {own === null ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {q.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => answer("suggestion", s)} className={`${opt} border border-latte-line bg-surface text-espresso hover:bg-latte-wash`}>
                {s}
              </button>
            ))}
            {q.suggestions.length > 0 && (
              <button type="button" onClick={() => setOwn("")} className={`${opt} text-ink-3 hover:bg-latte-wash`}>
                Something else
              </button>
            )}
            <button
              type="button"
              onClick={() => answer("left_out")}
              className={`${opt} ${q.suggestions.length ? "text-ink-3 hover:bg-latte-wash" : "border border-latte-line bg-surface text-espresso hover:bg-latte-wash"}`}
            >
              Leave it out
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (own.trim()) answer("own_words", own.trim());
            }}
            className="mt-2.5 flex flex-wrap items-end gap-2"
          >
            <label htmlFor={id} className="sr-only">
              Your answer
            </label>
            <input id={id} value={own} maxLength={200} onChange={(e) => setOwn(e.target.value)} className="min-h-11 flex-1 rounded-md border border-line px-3" autoFocus />
            <button type="submit" className={`${opt} bg-espresso text-surface`}>
              Save answer
            </button>
            <button type="button" onClick={() => setOwn(null)} className={`${opt} text-ink-3`}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
