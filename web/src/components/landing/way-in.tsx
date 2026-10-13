"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { InstagramOnlyNote, SignInButton } from "@/components/session/sign-in-buttons";
import { api } from "@/lib/api";

type Answer = "asking" | "in" | "out";
/** What `GET /me` said, and whether it said it soon enough for the way in to fade in. */
type SignedIn = { answer: Answer; fade: boolean };
const SignedInContext = createContext<SignedIn>({ answer: "out", fade: false });

/** LP-FR-18 (1.9): after this long without an answer, the signed-out way in shows (in CSS, `.lp-wait`). */
const REVEAL_MS = 1500;

const OPEN =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-pill bg-espresso px-[22px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover";

/**
 * Asks `GET /me` once, in the browser after the page loads, and tells the
 * landing page's buttons whether the visitor is signed in. While it asks, the
 * way in is hidden but keeps its space; signed out, or if the call fails, the
 * page is as before. Without an answer in 1.5 s, CSS shows the signed-out way in.
 *
 * @see docs/specs/landing-frd.md LP-FR-18 (1.9)
 */
export function SignedInProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<SignedIn>({ answer: "asking", fade: false });
  useEffect(() => {
    let current = true;
    const start = performance.now();
    const answer = (a: Answer) => current && setSignedIn({ answer: a, fade: performance.now() - start < REVEAL_MS });
    api.getProfile().then(
      (r) => answer(r.ok ? "in" : "out"),
      () => answer("out"),
    );
    return () => {
      current = false;
    };
  }, []);
  return <SignedInContext.Provider value={signedIn}>{children}</SignedInContext.Provider>;
}

/**
 * How a way in shows: hidden while asking (inline, so it holds without the
 * stylesheet; `.lp-wait` reveals it at 1.5 s), faded in on a timely answer.
 */
function reveal({ answer, fade }: SignedIn): { className: string; style?: CSSProperties } {
  if (answer === "asking") return { className: "lp-wait", style: { visibility: "hidden" } };
  return { className: fade ? "lp-fade" : "" };
}

/** Whether the visitor is known to be signed in (false while asking, signed out, or if the call failed). */
export const useSignedIn = (): boolean => useContext(SignedInContext).answer === "in";

/**
 * The landing page's way in: "Sign in with Google" (with the Instagram-only
 * line in the hero), or "Open your deals" to home once the visitor is known
 * to be signed in.
 *
 * @param note - show the Instagram-only line under it (the hero)
 * @param onDark - on the espresso closing band
 * @see docs/specs/landing-frd.md LP-FR-03, LP-FR-17, LP-FR-18 (1.9)
 */
export function WayIn({ note = false, onDark = false }: { note?: boolean; onDark?: boolean }) {
  const signedIn = useContext(SignedInContext);
  const { className, style } = reveal(signedIn);
  if (signedIn.answer === "in") {
    return (
      <>
        <Link href="/deals" className={`${OPEN} ${onDark ? "bg-marigold text-marigold-ink hover:bg-marigold-chip" : ""} ${className}`}>
          Open your deals
        </Link>
        {/* 1.9: the line's room is kept, so nothing below moves. */}
        {note && (
          <div className="mt-2.5" style={{ visibility: "hidden" }} aria-hidden="true">
            <InstagramOnlyNote />
          </div>
        )}
      </>
    );
  }
  return (
    <>
      <span className={`inline-flex ${className}`} style={style}>
        <SignInButton next="/deals" onDark={onDark} />
      </span>
      {note && (
        <div className={`mt-2.5 ${className}`} style={style}>
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
 * @see docs/specs/landing-frd.md LP-FR-01, LP-FR-18 (1.6, 1.9)
 */
export function HeaderWayIn({ className }: { className: string }) {
  const signedIn = useContext(SignedInContext);
  const shown = reveal(signedIn);
  const inside = signedIn.answer === "in";
  return (
    <Link href={inside ? "/deals" : "/sign-in"} className={`${className} ${shown.className}`} style={shown.style}>
      {inside ? "Your deals" : "Sign in"}
    </Link>
  );
}
