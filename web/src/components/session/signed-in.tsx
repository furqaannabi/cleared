"use client";

import { useEffect, type ReactNode } from "react";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { signInPath } from "@/lib/session/sign-in-path";
import { useSession } from "./use-session";

/**
 * The page, only for a signed-in creator. Signed out, it goes to `/sign-in`
 * with where the creator was going (SI-FR-06, SI-FR-07).
 *
 * @param children - the page
 * @see docs/specs/sign-in-frd.md SI-FR-06, SI-FR-07
 */
export function SignedIn({ children }: { children: ReactNode }) {
  const { load, retry } = useSession();
  const here = typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`;
  const target = signInPath(here);
  useEffect(() => {
    if (load.status === "signed_out") window.location.replace(target);
  }, [load.status, target]);
  if (load.status === "signed_in") return <>{children}</>;
  if (load.status === "error") return <main id="main" className="px-4 pt-6 md:px-9"><LoadProblem error="unavailable" onRetry={retry} /></main>;
  if (load.status === "signed_out")
    return (
      <main id="main" className="px-4 pt-6 text-ink-2 md:px-9">
        Taking you to sign in…{" "}
        <a href={target} className="font-bold text-espresso underline underline-offset-3">
          Sign in
        </a>
      </main>
    );
  return null;
}
