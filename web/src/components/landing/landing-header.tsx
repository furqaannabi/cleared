import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { DemoButton } from "./demo-button";

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
      <span className="hidden md:block">
        <DemoButton size="sm" />
      </span>
    </header>
  );
}
