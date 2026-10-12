/* Home's small icons: one stroke, drawn here (DESIGN.md: icons plus words, never colour alone). */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const LockIcon = ({ className = "size-4" }) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const ClockIcon = ({ className = "size-4" }) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const CheckIcon = ({ className = "size-4" }) => (
  <svg {...base} strokeWidth={2.5} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.5L16 9.5" />
  </svg>
);
export const CrossIcon = ({ className = "size-4" }) => (
  <svg {...base} strokeWidth={2.5} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </svg>
);
export const ArrowIcon = ({ className = "size-[18px]" }) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const DownloadIcon = ({ className = "size-4" }) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
