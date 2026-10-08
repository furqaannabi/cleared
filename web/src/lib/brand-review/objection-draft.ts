import type { BrandItem } from "./types";

/** One objection being written: the item and the brand's note (RW-BR-02). Kept in memory only (DC-BR-08). */
export interface Objection {
  itemId: string;
  note: string;
}

const NOTE_MAX = 500;

/**
 * Whether the brand can object to an item: only one that passed. Not one it
 * accepted earlier, nor one checked once the creator posts.
 *
 * @see docs/specs/brand-review-frd.md RW-FR-17, RW-BR-03
 */
export const canObject = (item: BrandItem) => item.status === "passed";

/**
 * Saves an objection, or edits the one already on that item. The note is
 * required, trimmed, and at most 500 characters.
 *
 * @param objections - the objections saved so far
 * @param items - the draft's items
 * @param itemId - the item objected to
 * @param note - the brand's note, as typed
 * @see docs/specs/brand-review-frd.md RW-FR-17
 */
export function saveObjection(
  objections: Objection[],
  items: BrandItem[],
  itemId: string,
  note: string,
): { ok: true; objections: Objection[] } | { ok: false; problem: string } {
  const item = items.find((i) => i.id === itemId);
  if (!item || !canObject(item)) return { ok: false, problem: "This item can’t be objected to." };
  const text = note.trim();
  if (!text) return { ok: false, problem: "Say what’s wrong with this item." };
  if (text.length > NOTE_MAX) return { ok: false, problem: "Keep it to 500 characters." };
  const at = objections.findIndex((o) => o.itemId === itemId);
  const next = at < 0 ? [...objections, { itemId, note: text }] : objections.map((o, i) => (i === at ? { itemId, note: text } : o));
  return { ok: true, objections: next };
}

/** Drops the objection on one item (RW-FR-17's Remove). */
export const removeObjection = (objections: Objection[], itemId: string) => objections.filter((o) => o.itemId !== itemId);
