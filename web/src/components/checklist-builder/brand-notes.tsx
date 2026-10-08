import { noteTarget } from "@/lib/brand-deal/terms-view";
import type { Note } from "@/lib/brand-deal/types";
import type { DealDraft } from "@/lib/checklist-builder/types";

/** The brand's notes on the version it last saw; earlier rounds are answered. */
export function latestNotes(notes: Note[] | undefined): Note[] {
  if (!notes?.length) return [];
  const version = Math.max(...notes.map((n) => n.version));
  return notes.filter((n) => n.version === version);
}

/**
 * The brand's notes about the deal as a whole and about brief lines, at the
 * top of the checklist page while the creator answers them. Notes about an
 * item sit beside the item. Plain text, read-only here; replies are on the
 * invite page.
 *
 * @param draft - the deal draft, with the brand's notes
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-22, CH-BR-07
 */
export function BrandNotesOnChecklist({ draft }: { draft: DealDraft }) {
  const notes = latestNotes(draft.notes);
  if (notes.length === 0 || (draft.step !== "checklist" && draft.step !== "changes_requested")) return null;
  const top = notes.filter((n) => n.about.kind === "deal" || n.about.kind === "line");
  const target = (n: Note) =>
    noteTarget({ posts: draft.deliverables.map((d) => ({ deliverableId: d.id, platform: d.platform })), items: draft.items, brief: draft.brief?.lines ?? [] }, n.about);
  return (
    <section aria-labelledby="brand-notes-heading" className="mt-6 grid gap-2 rounded-[18px] border border-latte-line bg-surface p-[18px]">
      <h2 id="brand-notes-heading" className="font-head text-[18px] font-extrabold">
        {draft.brandName} asked for {notes.length} {notes.length === 1 ? "change" : "changes"}
      </h2>
      <p className="text-[14px] text-ink-2">Notes about an item sit beside it below. Reply to any of them on the terms page.</p>
      {top.length > 0 && (
        <ul className="grid">
          {top.map((n) => (
            <li key={n.id} className="grid gap-0.5 border-t border-line-soft py-2.5 first:border-t-0">
              <p className="text-meta font-bold text-ink-3">{target(n)}</p>
              <p className="text-[15px] whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
