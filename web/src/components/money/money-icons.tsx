/** Decorative money icons on DESIGN.md's 24px stroke grid, in `currentColor`. */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** The padlock inside the held seal. */
export function LockIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** The return arrow inside the released seal. */
export function ReturnIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}
