/**
 * A brand's note asking for a change, and the creator's reply (deal set-up spec DS-FR-38, DS-FR-39).
 * Both are untrusted plain text: kept and returned as text, never acted on (DS-BR-04).
 */

/** What a note is about: an item, a line of the brief, a post's amount or deadline, or the deal as a whole. */
export type NoteAbout =
  | { kind: "item"; itemId: string }
  | { kind: "line"; briefLine: number }
  | { kind: "amount" | "deadline"; deliverableId: string }
  | { kind: "deal" };

export interface DealNote {
  id: string;
  about: NoteAbout;
  text: string;
  reply?: string;
  /** The version the brand was shown when it wrote the note. */
  version: number;
}

/** How notes are read from the database: in the order they were sent. */
export const inOrder = { orderBy: { position: "asc" } } as const;

/** A stored note, in the shape the pages expect. */
export function noteOf(row: {
  id: string;
  kind: string;
  itemId: string | null;
  briefLine: number | null;
  deliverableId: string | null;
  text: string;
  reply: string | null;
  version: number;
}): DealNote {
  const about: NoteAbout =
    row.kind === "item" && row.itemId !== null
      ? { kind: "item", itemId: row.itemId }
      : row.kind === "line" && row.briefLine !== null
        ? { kind: "line", briefLine: row.briefLine }
        : (row.kind === "amount" || row.kind === "deadline") && row.deliverableId !== null
          ? { kind: row.kind, deliverableId: row.deliverableId }
          : { kind: "deal" };
  return { id: row.id, about, text: row.text, ...(row.reply === null ? {} : { reply: row.reply }), version: row.version };
}
