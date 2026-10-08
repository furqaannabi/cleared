import Link from "next/link";
import { Logo } from "@/components/shell/logo";

/**
 * The landing header: the logo (home) and, from `md:` up, the one action again.
 *
 * @see docs/specs/landing-frd.md LP-FR-01
 */
export function LandingHeader() {
  return (
    <header className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-4 md:px-8">
      <Link href="/" aria-label="Cleared home" className="rounded-pill">
        <Logo tone="light" />
      </Link>
      {/* A quiet way back in for returning creators; the hero holds the two ways in (LP-FR-03, 1.2). */}
      <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-pill px-3 text-[15px] font-bold text-espresso underline decoration-latte-line underline-offset-3">
        Sign in
      </Link>
    </header>
  );
}
