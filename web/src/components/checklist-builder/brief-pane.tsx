import { api } from "@/lib/api";
import type { ChecklistView } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";
import type { Save } from "./checklist-builder";

/**
 * BC-FR-12: the brief's numbered lines, each saying what became of it ("2
 * items", "Question", "Not checked"). The line the selected item cites is
 * marked. An answered question can be reopened until the checklist is ready
 * (BC-FR-13). From `lg:` up only; phones show each item's line inline.
 */
export function BriefPane({ view, draft, selectedLine, save, readOnly }: { view: ChecklistView; draft: DealDraft; selectedLine: number | null; save: Save; readOnly: boolean }) {
  return (
    <section aria-labelledby="brief-heading" className="hidden rounded-lg border border-line bg-surface px-5 py-[18px] lg:sticky lg:top-5 lg:block">
      <h2 id="brief-heading" className="font-head text-item-title font-bold">
        The brief
      </h2>
      <ol className="mt-3 grid gap-1">
        {view.lines.map((l) => {
          const answered = draft.questions.find((q) => q.briefLine === l.number && q.answer);
          return (
            <li
              key={l.number}
              aria-current={l.number === selectedLine || undefined}
              className="grid grid-cols-[22px_1fr] gap-x-2 gap-y-0.5 rounded-sm px-2 py-1.5 aria-[current=true]:bg-marigold/25"
            >
              <span className="text-meta font-extrabold text-ink-3 tabular-nums">{l.number}</span>
              {/* BC-BR-03: the brief is plain text, never formatted or linked. */}
              <span className="text-[15px] leading-snug text-ink-2">{l.text}</span>
              <span className={`col-start-2 text-[12.5px] font-semibold ${l.status === "Question" ? "font-bold text-unsure" : "text-ink-4"}`}>
                {l.status}
                {answered && !readOnly && (
                  <button
                    type="button"
                    onClick={() => save(() => api.reopenQuestion(draft.id, answered.id))}
                    className="relative ml-2 font-bold text-espresso underline underline-offset-2 before:absolute before:-inset-3 before:content-['']"
                  >
                    Change answer
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
