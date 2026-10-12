"use client";

import Link from "next/link";
import { LandingFooter } from "@/components/landing/closing-and-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { SignedInProvider, useSignedIn } from "@/components/landing/way-in";

const BUTTON = "inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover";

function NextStep() {
  const signedIn = useSignedIn();
  return signedIn ? (
    <Link href="/deals" className={BUTTON}>
      Open your deals
    </Link>
  ) : (
    <Link href="/" className={BUTTON}>
      Go to the home page
    </Link>
  );
}

/**
 * Not found, for anyone: the landing header and footer, "We can't find that
 * page", and the next step for who is reading (Open your deals when signed
 * in, otherwise Go to the home page), with a line for brands.
 *
 * @see docs/specs/error-pages-frd.md EP-FR-01, EP-FR-02
 */
export function NotFoundPage() {
  return (
    <SignedInProvider>
      <div className="flex min-h-dvh flex-col overflow-x-clip">
        <LandingHeader />
        <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
          <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">We can’t find that page</h1>
          <p className="mt-2 text-ink-2">The address may be mistyped, or the page may have moved.</p>
          <div className="mt-5">
            <NextStep />
          </div>
          <p className="mt-5 text-[13.5px] text-ink-3">Opening a deal from a creator’s link? Open the link again, or ask them for a new one.</p>
        </main>
        <LandingFooter />
      </div>
    </SignedInProvider>
  );
}
