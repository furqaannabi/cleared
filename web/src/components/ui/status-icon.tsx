import type { StatusIcon as StatusIconName } from "@/lib/checklist/item-status";

const PATHS: Record<StatusIconName, React.ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  cross: <path d="M18 6 6 18M6 6l12 12" />,
  question: (
    <>
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 1 1-6.22-8.56" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />,
};

/**
 * One of the status icons from DESIGN.md: a 24px-grid stroke icon in
 * `currentColor`. Decorative; the word beside it carries the meaning.
 * The spinner turns only when motion is allowed.
 *
 * @param name - which icon
 * @param className - size and colour classes
 * @param strokeWidth - stroke weight, 2 by default
 */
export function StatusIcon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: StatusIconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={[name === "spinner" ? "motion-safe:animate-spin" : "", className].filter(Boolean).join(" ")}
    >
      {PATHS[name]}
    </svg>
  );
}
