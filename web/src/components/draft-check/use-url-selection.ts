"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChecklistTab } from "@/lib/checklist/item-status";

// pushState and replaceState fire no event, so this hook announces its own writes.
const CHANGE = "cleared:url-selection";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}
const getSearch = () => window.location.search;
const getServerSearch = () => "";

type Next = { item?: string | null; tab?: ChecklistTab };

/**
 * The selected item and the filter tab, kept in the URL as `item` and `tab`
 * (DC-FR-36). Uses the browser's history directly, which Next.js keeps in step
 * with its router, so changing them never refetches anything; Back steps
 * through them. No `item` means the default selection (DC-FR-21); an empty
 * `item` means nothing is selected (a closed card). Unknown values fall back
 * to the defaults.
 *
 * @param defaultItemId - DC-FR-21's selection when the URL names none
 * @param itemIds - the deliverable's items, to ignore an unknown `item`
 * @param tabIds - the tabs shown, to ignore an unknown `tab`
 * @see docs/specs/creator-draft-check-frd.md DC-FR-36, DC-FR-21
 */
export function useUrlSelection(defaultItemId: string | null, itemIds: string[], tabIds: ChecklistTab[]) {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const params = new URLSearchParams(search);
  const item = params.get("item");
  const tab = params.get("tab") as ChecklistTab | null;

  const selectedId = item === null ? defaultItemId : item === "" ? null : itemIds.includes(item) ? item : defaultItemId;
  const filter: ChecklistTab = tab && tabIds.includes(tab) ? tab : "all";

  /** Writes the next selection and tab; `replace` for changes the creator didn't make. */
  const write = useCallback((next: Next, replace = false) => {
    const p = new URLSearchParams(window.location.search);
    if (next.item !== undefined) p.set("item", next.item ?? "");
    if (next.tab !== undefined) {
      if (next.tab === "all") p.delete("tab");
      else p.set("tab", next.tab);
    }
    const query = p.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new Event(CHANGE));
  }, []);

  return {
    selectedId,
    filter,
    select: useCallback((id: string | null) => write({ item: id }), [write]),
    setFilter: useCallback((t: ChecklistTab) => write({ tab: t }), [write]),
    /** Selects an item and shows All, as one step in history. */
    show: useCallback((id: string) => write({ item: id, tab: "all" }), [write]),
    /** DC-FR-21: a new run's default selection, replacing the old run's (not a step in history). */
    reset: useCallback((id: string | null) => write({ item: id, tab: "all" }, true), [write]),
  };
}
