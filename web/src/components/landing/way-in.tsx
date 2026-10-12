"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { InstagramOnlyNote, SignInButton } from "@/components/session/sign-in-buttons";
import { api } from "@/lib/api";

const SignedInContext = createContext(false);

const OPEN =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-pill bg-espresso px-[22px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover";

/**
 * Asks `GET /me` once, in the browser after the page loads, and tells the
 * landing page's buttons whether the visitor is signed in. Signed out, still
 * asking, or if the call fails, it says no, so the page is as before.
 *
 * @see docs/specs/landing-frd.md LP-FR-18
 */
export function SignedInProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let current = true;
    api.getProfile().then((r) => current && setSignedIn(r.ok));
    return () => {
      current = false;
    };
  }, []);
  return <SignedInContext.Provider value={signedIn}>{children}</SignedInContext.Provider>;
}

/**
 * The landing page's way in: "Sign in with Google" (with the Instagram-only
 * line in the hero), or "Open your deals" to home once the visitor is known
 * to be signed in.
 *
 * @param note - show the Instagram-only line under it (the hero)
 * @param onDark - on the espresso closing band
 * @see docs/specs/landing-frd.md LP-FR-03, LP-FR-17, LP-FR-18
 */
export function WayIn({ note = false, onDark = false }: { note?: boolean; onDark?: boolean }) {
  const signedIn = useContext(SignedInContext);
  if (signedIn) {
    return (
      <Link href="/deals" className={`${OPEN} ${onDark ? "bg-marigold text-marigold-ink hover:bg-marigold-chip" : ""}`}>
        Open your deals
      </Link>
    );
  }
  return (
    <>
      <SignInButton next="/deals" onDark={onDark} />
      {note && (
        <div className="mt-2.5">
          <InstagramOnlyNote />
        </div>
      )}
    </>
  );
}

/**
 * The header's quiet link: "Sign in" to the sign-in page, or "Your deals" to
 * home once the visitor is known to be signed in.
 *
 * @see docs/specs/landing-frd.md LP-FR-01, LP-FR-18 (1.6)
 */
export function HeaderWayIn({ className }: { className: string }) {
  const signedIn = useContext(SignedInContext);
  return (
    <Link href={signedIn ? "/deals" : "/sign-in"} className={className}>
      {signedIn ? "Your deals" : "Sign in"}
    </Link>
  );
}
