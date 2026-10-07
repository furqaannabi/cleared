import type { ComponentProps } from "react";

/**
 * A native select (keyboard, screen readers and phone pickers stay native)
 * with the browser's arrow hidden and a drawn chevron 14px in from the right
 * edge, so it never crowds the border. No business logic.
 *
 * @param className - extra classes for the select (height, width)
 */
export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <span className="relative flex min-w-0 flex-1">
      <select
        {...props}
        className={`min-h-11 w-full appearance-none rounded-md border border-line bg-surface pr-10 pl-3 text-body-strong text-ink ${className}`}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
