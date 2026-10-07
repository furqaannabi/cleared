"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Seal } from "@/components/ui/seal";
import { api } from "@/lib/api";
import { PLATFORM_LABEL, type ChecklistView, type ItemRow } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";
import type { Save } from "./checklist-builder";

/**
 * BC-FR-10, BC-FR-14, BC-FR-18: the current post's items. Each shows its name,
 * one plain line ("Said · Exact match · Line 4"), and on phones the brief
 * line's words. Its menu edits the wording, copies or moves it to another
 * post, or removes it. A failed save is said beside the item.
 */
export function ItemList(props: {
  draft: DealDraft;
  view: ChecklistView;
  selected: string | null;
  onSelect: (id: string) => void;
  save: Save;
  problems: Record<string, string>;
  readOnly: boolean;
}) {
  const { view } = props;
  if (view.items.length === 0) {
    return <p className="rounded-md border border-dashed border-line p-6 text-center text-ink-3">No items for this post yet.</p>;
  }
  return (
    <ul aria-label="Checklist items" className="grid gap-2">
      {view.items.map((item) => (
        <Item key={item.id} item={item} {...props} />
      ))}
    </ul>
  );
}

function Item({ item, draft, view, selected, onSelect, save, problems, readOnly }: { item: ItemRow } & Parameters<typeof ItemList>[0]) {
  const [editing, setEditing] = useState(false);
  const isSelected = item.id === selected;
  return (
    <li className={`grid grid-cols-[26px_1fr_auto] items-start gap-3 rounded-md border bg-surface px-3.5 py-3 ${isSelected ? "border-espresso ring-1 ring-espresso" : "border-line"}`}>
      <Seal fillClassName="fill-latte" className="mt-0.5 size-[26px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Seal>
      <div className="min-w-0">
        {editing ? (
          <EditWording item={item} onCancel={() => setEditing(false)} onSave={async (name) => (await save(() => api.renameItem(draft.id, item.id, name), item.id)) && setEditing(false)} />
        ) : (
          <button type="button" onClick={() => onSelect(item.id)} className="text-left text-[15px] font-bold">
            {item.name}
          </button>
        )}
        <p className="mt-0.5 text-[13px] text-ink-3">
          {item.kindLabel} · {item.howLabel} · {item.source}
        </p>
        {item.sourceText && <p className="mt-1.5 text-[13px] text-ink-3 lg:hidden">Line {item.briefLine}: “{item.sourceText}”</p>}
        {problems[item.id] && (
          <p role="alert" className="mt-1.5 text-meta font-semibold text-fail">
            {problems[item.id]}
          </p>
        )}
      </div>
      {!readOnly && !editing && <ItemMenu item={item} draft={draft} view={view} save={save} onEdit={() => setEditing(true)} />}
    </li>
  );
}

function EditWording({ item, onCancel, onSave }: { item: ItemRow; onCancel: () => void; onSave: (name: string) => void }) {
  const id = useId();
  const [name, setName] = useState(item.name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor={id} className="sr-only">
        Wording
      </label>
      <input id={id} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus className="min-h-11 flex-1 rounded-md border border-line px-3 font-bold" />
      <button type="submit" className="min-h-11 rounded-pill bg-espresso px-4 font-bold text-surface">
        Save
      </button>
      <button type="button" onClick={onCancel} className="min-h-11 rounded-pill px-3 font-bold text-ink-3">
        Cancel
      </button>
    </form>
  );
}

function ItemMenu({ item, draft, view, save, onEdit }: { item: ItemRow; draft: DealDraft; view: ChecklistView; save: Save; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = draft.deliverables.filter((d) => d.id !== view.currentTab);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const entry = "flex min-h-11 w-full items-center px-3.5 text-left text-[14px] font-semibold hover:bg-latte-wash focus:bg-latte-wash focus:outline-none";
  return (
    <div ref={ref} className="relative -mt-2.5 -mr-2.5" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-label={`Change “${item.name}”`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-pill text-ink-3 hover:bg-latte-wash"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-11 right-0 z-20 w-60 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-floating-bar">
          <button role="menuitem" type="button" className={entry} onClick={act(onEdit)}>
            Edit wording
          </button>
          {others.map((o) => (
            <button key={`c${o.id}`} role="menuitem" type="button" className={entry} onClick={act(() => save(() => api.copyItem(draft.id, item.id, o.id), item.id))}>
              Copy to {PLATFORM_LABEL[o.platform]}
            </button>
          ))}
          {others.map((o) => (
            <button key={`m${o.id}`} role="menuitem" type="button" className={entry} onClick={act(() => save(() => api.moveItem(draft.id, item.id, o.id), item.id))}>
              Move to {PLATFORM_LABEL[o.platform]}
            </button>
          ))}
          <button role="menuitem" type="button" className={`${entry} text-fail`} onClick={act(() => save(() => api.removeItem(draft.id, item.id), item.id))}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
