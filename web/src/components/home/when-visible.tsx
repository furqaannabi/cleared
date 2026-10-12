"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children only once its box scrolls into view, so a heavy chunk
 * (the charts) stays off the first paint. Where IntersectionObserver doesn't
 * exist nothing is drawn; the text beside it carries the content.
 *
 * @see docs/decisions/2026-10-12-ag-grid-and-ag-charts-on-creator-home.md
 */
export function WhenVisible({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className={className}>
      {seen && children}
    </div>
  );
}
