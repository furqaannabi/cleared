"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Note } from "@/lib/brand-deal/types";

/** A note the brand has written but not sent: what it's about, what it's about in words, and its text. */
export interface DraftNote {
  key: string;
  about: Note["about"];
  target: string;
  text: string;
}

interface Notes {
  /** Whether "Ask for a change" is offered: only before the brand sends notes or agrees (CH-FR-10). */
  editable: boolean;
  drafts: DraftNote[];
  /** The note being written, by key. */
  editing: string | null;
  setEditing: (key: string | null) => void;
  save: (note: DraftNote) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const NotesContext = createContext<Notes | null>(null);

/**
 * Holds the brand's unsent notes for the page's life (CH-FR-11; keeping them
 * across devices depends on the backend), and which one is being written.
 *
 * @param editable - whether notes can be written now
 * @param children - the page
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-10, CH-FR-11
 */
export function NotesProvider({ editable, children }: { editable: boolean; children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftNote[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const save = useCallback((note: DraftNote) => {
    setDrafts((all) => (all.some((n) => n.key === note.key) ? all.map((n) => (n.key === note.key ? note : n)) : [...all, note]));
    setEditing(null);
  }, []);
  const remove = useCallback((key: string) => setDrafts((all) => all.filter((n) => n.key !== key)), []);
  const clear = useCallback(() => setDrafts([]), []);
  const value = useMemo(() => ({ editable, drafts, editing, setEditing, save, remove, clear }), [editable, drafts, editing, save, remove, clear]);
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/** The brand's notes on this page. */
export function useNotes(): Notes {
  const notes = useContext(NotesContext);
  if (!notes) throw new Error("useNotes needs a NotesProvider");
  return notes;
}

/** A stable key for what a note is about. */
export function noteKey(about: Note["about"]): string {
  switch (about.kind) {
    case "item":
      return `item:${about.itemId}`;
    case "line":
      return `line:${about.briefLine}`;
    case "amount":
    case "deadline":
      return `${about.kind}:${about.deliverableId}`;
    default:
      return "deal";
  }
}
