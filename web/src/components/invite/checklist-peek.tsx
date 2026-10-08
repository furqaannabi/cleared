"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { DraftItem } from "@/lib/checklist-builder/types";

/**
 * A post's checklist, folded: "{n} checklist items · View". View opens the
 * item names, read-only, loaded when first opened.
 *
 * @param dealId - the deal
 * @param deliverableId - the post
 * @param label - the post, e.g. "YouTube video"
 * @param count - how many items the post has
 * @see docs/specs/creator-invite-frd.md IN-FR-03
 */
export function ChecklistPeek({ dealId, deliverableId, label, count }: { dealId: string; deliverableId: string; label: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    setOpen((o) => !o);
    if (items) return;
    const r = await api.getDealDraft(dealId);
    if (r.ok) setItems(r.data.items.filter((i) => i.deliverableId === deliverableId));
    else setFailed(true);
  }

  return (
    <div>
      <p className="text-meta text-ink-3">
        {count} checklist {count === 1 ? "item" : "items"} ·{" "}
        <button type="button" aria-expanded={open} onClick={toggle} className="inline-flex min-h-11 items-center font-bold text-espresso underline underline-offset-3">
          {open ? "Hide" : "View"}
          <span className="sr-only">{` the ${label} checklist`}</span>
        </button>
      </p>
      {open && failed && <p className="text-meta text-ink-3">We couldn’t load the checklist.</p>}
      {open && items && (
        <ul aria-label={`${label} checklist`} className="mt-1 grid list-disc gap-1 pl-5 text-[14px] text-ink-2 marker:text-ink-4">
          {items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
