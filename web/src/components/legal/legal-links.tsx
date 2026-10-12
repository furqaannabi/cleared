import Link from "next/link";

/**
 * "Privacy", "Terms" and "Data deletion" as quiet links, for a footer.
 *
 * @param tone - "dark" on the espresso footer, "light" on the light ground
 * @see docs/specs/legal-pages-frd.md LG-FR-15 (1.1)
 */
export function LegalLinks({ tone = "light" }: { tone?: "dark" | "light" }) {
  const cls = `inline-flex min-h-11 items-center underline underline-offset-2 ${tone === "dark" ? "text-white" : "text-ink-3 decoration-latte-line"}`;
  return (
    <nav aria-label="Legal">
      <ul className="flex flex-wrap gap-x-4">
        <li>
          <Link href="/privacy" className={cls}>
            Privacy
          </Link>
        </li>
        <li>
          <Link href="/terms" className={cls}>
            Terms
          </Link>
        </li>
        <li>
          <Link href="/data-deletion" className={cls}>
            Data deletion
          </Link>
        </li>
      </ul>
    </nav>
  );
}
