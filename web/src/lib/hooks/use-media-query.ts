"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept up to date as the window changes.
 * False on the server and wherever `matchMedia` doesn't exist, so phones are
 * the default (mobile-first).
 *
 * @param query - a media query, e.g. "(min-width: 768px)"
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}
