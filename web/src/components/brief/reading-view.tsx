import type { DealDraft } from "@/lib/checklist-builder/types";

/**
 * BC-FR-07: the brief's numbered lines while the AI reads them, each marked
 * as it is reached. Progress is announced politely. The creator can leave;
 * coming back shows the current state.
 *
 * @param draft - the deal draft being read
 */
export function ReadingView({ draft }: { draft: DealDraft }) {
  const lines = draft.brief?.lines ?? [];
  const upTo = draft.readUpTo ?? 0;
  return (
    <section aria-label="Reading your brief" className="max-w-3xl rounded-lg border border-line bg-surface p-5 shadow-panel">
      <h2 className="font-head text-item-title font-bold">Reading your brief…</h2>
      <p role="status" className="mt-1 text-meta text-ink-3">
        Read {upTo} of {lines.length} lines. You can leave this page; the checklist will be here when it’s done.
      </p>
      <ol className="mt-4 grid gap-1.5">
        {lines.map((l) => {
          const state = l.number <= upTo ? "read" : l.number === upTo + 1 ? "reading" : "waiting";
          return (
            <li key={l.number} className={`grid grid-cols-[22px_1fr_auto] items-start gap-2.5 rounded-sm px-2 py-1.5 ${state === "reading" ? "bg-latte-wash" : ""}`}>
              <span className="text-meta font-extrabold text-ink-3 tabular-nums">{l.number}</span>
              <span className={state === "waiting" ? "text-ink-3" : "text-ink-2"}>{l.text}</span>
              <span className="text-label font-semibold text-ink-4">{state === "read" ? "Read" : state === "reading" ? "Reading" : ""}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
