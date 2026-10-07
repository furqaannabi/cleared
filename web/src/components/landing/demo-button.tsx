import Link from "next/link";

/**
 * "See a deal in action": the page's one action, opening `/deals` (LP-FR-15).
 *
 * @param size - "sm" in the header, full size elsewhere
 * @param tone - "marigold" on the espresso closing band
 * @see docs/specs/landing-frd.md LP-FR-03
 */
export function DemoButton({ size = "md", tone = "espresso" }: { size?: "sm" | "md"; tone?: "espresso" | "marigold" }) {
  return (
    <Link
      href="/deals"
      className={`inline-flex items-center justify-center rounded-pill font-bold shadow-[0_2px_6px_rgb(28_21_10/0.2)] transition-colors ${
        size === "sm" ? "min-h-11 px-[18px] text-[15px]" : "min-h-12 px-[22px] text-body-strong"
      } ${tone === "marigold" ? "bg-marigold text-marigold-ink hover:bg-marigold-chip" : "bg-espresso text-surface hover:bg-espresso-hover"}`}
    >
      See a deal in action
    </Link>
  );
}

/** LP-FR-04: the honest note beside every button. */
export function DemoNote({ onDark = false }: { onDark?: boolean }) {
  return <p className={`mt-2.5 text-[13.5px] ${onDark ? "text-white/75" : "text-ink-3"}`}>Demo with made-up data. No real money moves.</p>;
}
