"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { KIND_LABEL, PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft, ItemKind } from "@/lib/checklist-builder/types";
import type { Save } from "./checklist-builder";

/**
 * BC-FR-15: add an item the brief doesn't mention. It is marked "Added by you,
 * not in the brief" so the brand sees it clearly (BC-BR-01).
 */
export function AddItemForm({ draft, currentTab, save }: { draft: DealDraft; currentTab: string; save: Save }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ItemKind>("said");
  const [post, setPost] = useState(currentTab);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setPost(currentTab);
          setOpen(true);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-latte-line font-bold text-espresso hover:bg-latte-wash"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true" className="size-4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add an item
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (await save(() => api.addItem(draft.id, { deliverableId: post, name: name.trim(), kind }))) {
          setOpen(false);
          setName("");
        }
      }}
      className="grid gap-3 rounded-md border border-line bg-surface p-4"
    >
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-n`} className="font-bold">
          What should the post do?
        </label>
        <input id={`${id}-n`} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus className="min-h-11 rounded-md border border-line px-3" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-k`} className="font-bold">
            Kind
          </label>
          <Select id={`${id}-k`} value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
            {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        {draft.deliverables.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-p`} className="font-bold">
              Post
            </label>
            <Select id={`${id}-p`} value={post} onChange={(e) => setPost(e.target.value)}>
              {draft.deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {PLATFORM_LABEL[d.platform]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <p className="text-meta text-ink-3">It will show as “Added by you, not in the brief”.</p>
      <div className="flex gap-2">
        <button type="submit" className="min-h-11 rounded-pill bg-espresso px-5 font-bold text-surface">
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-pill px-4 font-bold text-ink-3">
          Cancel
        </button>
      </div>
    </form>
  );
}
