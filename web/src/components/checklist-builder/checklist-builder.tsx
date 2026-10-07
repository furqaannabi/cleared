"use client";

import { useState } from "react";
import type { ApiResult } from "@/lib/api";
import { checklistView } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";
import { AddItemForm } from "./add-item-form";
import { BriefPane } from "./brief-pane";
import { ItemList } from "./item-list";
import { QuestionsPanel } from "./questions-panel";
import { ReadyBar } from "./ready-bar";

/** Runs a change against the API; on success the page takes the returned draft. */
export type Save = (call: () => Promise<ApiResult<DealDraft>>, itemId?: string) => Promise<boolean>;

/**
 * The checklist for a read brief: the brief's lines beside the items (from
 * `lg:`), the questions first, a tab per post, item changes, adding items and
 * "Checklist ready". Read-only once ready.
 *
 * @param draft - the deal draft (reading done)
 * @param onChange - called with the draft each saved change returns
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-09 to BC-FR-18
 */
export function ChecklistBuilder({ draft, onChange }: { draft: DealDraft; onChange: (d: DealDraft) => void }) {
  const [tab, setTab] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const view = checklistView(draft, tab);
  const selectedLine = draft.items.find((i) => i.id === selected)?.briefLine ?? null;
  const readOnly = draft.ready;

  const save: Save = async (call, itemId = "_") => {
    setProblems((p) => ({ ...p, [itemId]: "" }));
    const r = await call();
    if (r.ok) onChange(r.data);
    else setProblems((p) => ({ ...p, [itemId]: "We couldn’t save that. Try again." }));
    return r.ok;
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-7">
      <BriefPane view={view} draft={draft} selectedLine={selectedLine} save={save} readOnly={readOnly} />
      <div className="grid gap-4">
        {!readOnly && view.openQuestions.length > 0 && <QuestionsPanel draft={draft} questions={view.openQuestions} save={save} />}
        <div role="tablist" aria-label="Posts" className="flex w-max max-w-full gap-1.5 overflow-x-auto rounded-pill border border-line bg-surface p-1">
          {view.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === view.currentTab}
              onClick={() => setTab(t.id)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-pill px-3.5 text-[14px] font-bold whitespace-nowrap aria-selected:bg-espresso aria-selected:text-surface"
            >
              {t.label} <small className="text-xs font-semibold opacity-75">{t.count}</small>
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={view.tabs.find((t) => t.id === view.currentTab)?.label} className="grid gap-3">
          <ItemList draft={draft} view={view} selected={selected} onSelect={setSelected} save={save} problems={problems} readOnly={readOnly} />
          {!readOnly && <AddItemForm draft={draft} currentTab={view.currentTab} save={save} />}
        </div>
      </div>
      <div className="lg:col-span-2">
        <ReadyBar draft={draft} view={view} save={save} problem={problems._ || null} />
      </div>
    </div>
  );
}
