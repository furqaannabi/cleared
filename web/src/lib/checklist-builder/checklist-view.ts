import type { DealDraft, ItemKind, Question } from "./types";

export const PLATFORM_LABEL: Record<DealDraft["deliverables"][number]["platform"], string> = {
  youtube_video: "YouTube video",
  youtube_short: "YouTube Short",
  instagram_reel: "Instagram Reel",
};

/** BC-FR-10 / PRODUCT.md "What gets checked": each kind in plain words. */
export const KIND_LABEL: Record<ItemKind, string> = {
  said: "Said",
  shown_as_text: "Shown as text",
  shown: "Shown",
  timing: "Timing",
  written: "Written",
  disclosure: "Disclosure",
  publication: "Publication",
};

const HOW_LABEL = { exact_match: "Exact match", ai_timestamp: "AI, with a timestamp", at_live_check: "At the live check" } as const;

export interface ItemRow {
  id: string;
  name: string;
  kindLabel: string;
  howLabel: string;
  /** "Line 5", or "Added by you, not in the brief" (BC-BR-01). */
  source: string;
  /** The brief line's words, or null for an added item. */
  sourceText: string | null;
  briefLine: number | null;
}

export interface ChecklistView {
  tabs: { id: string; label: string; count: number }[];
  currentTab: string;
  items: ItemRow[];
  /** BC-FR-12: every brief line with what became of it: "2 items", "Question" or "Not checked". */
  lines: { number: number; text: string; status: string }[];
  openQuestions: Question[];
  /** BC-FR-16: whether "Checklist ready" is allowed, and what is left if not. */
  ready: { allowed: boolean; left: string | null };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything the checklist screen shows for one deal draft: the tabs, the
 * current deliverable's items, the brief's lines with their status, the open
 * questions and whether the checklist can be marked ready.
 *
 * @param d - the deal draft from the API
 * @param tab - the selected deliverable, or null for the first
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-09 to BC-FR-16, BC-BR-01, BC-BR-02
 */
export function checklistView(d: DealDraft, tab: string | null): ChecklistView {
  const lineText = new Map((d.brief?.lines ?? []).map((l) => [l.number, l.text]));
  const tabs = d.deliverables.map((x) => ({
    id: x.id,
    label: PLATFORM_LABEL[x.platform],
    count: d.items.filter((i) => i.deliverableId === x.id).length,
  }));
  const currentTab = tabs.some((t) => t.id === tab) ? tab! : tabs[0].id;

  const items: ItemRow[] = d.items
    .filter((i) => i.deliverableId === currentTab)
    .map((i) => ({
      id: i.id,
      name: i.name,
      kindLabel: KIND_LABEL[i.kind],
      howLabel: HOW_LABEL[i.checkedBy],
      source: i.addedByCreator || i.briefLine === undefined ? "Added by you, not in the brief" : `Line ${i.briefLine}`,
      sourceText: i.briefLine !== undefined && !i.addedByCreator ? (lineText.get(i.briefLine) ?? null) : null,
      briefLine: i.addedByCreator ? null : (i.briefLine ?? null),
    }));

  const openQuestions = d.questions.filter((q) => !q.answer).sort((a, b) => a.briefLine - b.briefLine);
  const lines = (d.brief?.lines ?? []).map((l) => {
    if (openQuestions.some((q) => q.briefLine === l.number)) return { ...l, status: "Question" };
    // Count what the line asks for once, however many deliverables carry it.
    const distinct = new Set(d.items.filter((i) => i.briefLine === l.number && !i.addedByCreator).map((i) => `${i.kind}|${i.name}`)).size;
    return { ...l, status: distinct ? plural(distinct, "item", "items") : "Not checked" };
  });

  const empty = tabs.find((t) => t.count === 0);
  const left = openQuestions.length
    ? `Answer ${plural(openQuestions.length, "question", "questions")} first.`
    : empty
      ? `Add an item to the ${empty.label} first.`
      : null;

  return { tabs, currentTab, items, lines, openQuestions, ready: { allowed: left === null, left } };
}
