import Link from "next/link";
import { api } from "@/lib/api";
import type { ChecklistView } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";
import type { Save } from "./checklist-builder";

/**
 * BC-FR-16, BC-FR-17: "Checklist ready", held back (with what is left) until
 * every question is answered and every post has an item; after it, what
 * happens next and the way on to the invite step (IN-FR-01). Fixed to the
 * bottom on phones.
 */
export function ReadyBar({ draft, view, save, problem }: { draft: DealDraft; view: ChecklistView; save: Save; problem: string | null }) {
  if (draft.ready) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-pass-wash bg-surface px-5 py-4 md:flex-row md:items-center md:justify-between">
        <p role="status" className="font-semibold">
          Your checklist is ready. Next you’ll set the amount and deadline for each post and invite {draft.brandName}.
        </p>
        <Link
          href={`/deals/${encodeURIComponent(draft.id)}/invite`}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-pill bg-espresso px-6 text-body-strong font-bold text-surface hover:bg-espresso-hover md:min-h-11"
        >
          Set amounts and invite {draft.brandName}
        </Link>
      </div>
    );
  }
  const allowed = view.ready.allowed;
  return (
    <section
      aria-label="Checklist ready"
      className="fixed inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-lg bg-surface p-3.5 shadow-floating-bar md:static md:flex-row md:items-center md:justify-between md:bg-latte-wash md:px-5 md:py-4 md:shadow-none"
    >
      <div className="text-[14.5px] text-ink-2">
        {allowed ? (
          <p>Every question is answered. {draft.brandName} will review the checklist before any money is held.</p>
        ) : (
          <p>
            <b className="text-ink">{view.ready.left}</b> Then the checklist is ready for {draft.brandName} to review.
          </p>
        )}
        {problem && (
          <p role="alert" className="mt-1 font-semibold text-fail">
            {problem}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-disabled={!allowed || undefined}
        onClick={() => {
          if (allowed) save(() => api.markChecklistReady(draft.id));
          else document.getElementById("questions-heading")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
        }}
        className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-pill bg-espresso px-6 text-body-strong font-bold text-surface hover:bg-espresso-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 md:min-h-11"
      >
        Checklist ready
      </button>
    </section>
  );
}
