"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "cleared.rail-folded";

function remembered(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked: open unfolded.
    return false;
  }
}

/** Typing in a field, where `[` is a character, not a shortcut. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Whether the desktop rail is folded to its icons, remembered in this browser
 * only, and toggled with the `[` key anywhere but in a field. Never sent
 * anywhere; with storage blocked it starts unfolded and isn't kept.
 *
 * @see docs/specs/creator-draft-check-frd.md DC-FR-55
 */
export function useRailFolded(): [boolean, () => void] {
  const [folded, setFolded] = useState(() => typeof window !== "undefined" && remembered());
  const toggle = useCallback(() => {
    setFolded((f) => {
      try {
        window.localStorage.setItem(KEY, f ? "0" : "1");
      } catch {
        // Not kept; the rail still folds for this visit.
      }
      return !f;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return [folded, toggle];
}
