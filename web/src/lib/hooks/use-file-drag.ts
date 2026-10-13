"use client";

import { useEffect, useRef, useState } from "react";

const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * Whether files are being dragged over the window, and what was dropped.
 * While on, a dropped file never opens in the browser in place of the page.
 * Drags of text or links are left alone.
 *
 * @param on - listen at all (desktop only)
 * @param onDrop - the files dropped anywhere on the page
 * @returns whether files are over the window now
 * @see docs/specs/creator-draft-check-frd.md DC-FR-56
 */
export function useFileDrag(on: boolean, onDrop: (files: File[]) => void): boolean {
  const [over, setOver] = useState(false);
  const dropped = useRef(onDrop);
  useEffect(() => {
    dropped.current = onDrop;
  });
  useEffect(() => {
    if (!on) return;
    // Enter and leave fire for every element crossed; count them to know when the drag has left the window.
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth += 1;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overPage = (e: DragEvent) => {
      if (carriesFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      dropped.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overPage);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overPage);
      window.removeEventListener("drop", drop);
      setOver(false);
    };
  }, [on]);
  return over;
}
