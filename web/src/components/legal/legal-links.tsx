import Link from "next/link";
import { legalPagesOn } from "@/lib/legal/flag";

/**
 * "Privacy", "Terms" and "Data deletion" as quiet links, for a footer.
 * Nothing at all while the legal flag is off.
 *
 * @param tone - "dark" on the espresso footer, "light" on the light ground
 * @see docs/specs/legal-pages-frd.md LG-FR-14, LG-FR-15
 */
export function LegalLinks({ tone = "light" }: { tone?: "dark" | "light" }) {
  if (!legalPagesOn()) return null;
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
