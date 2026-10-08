"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/session/account-menu";
import { SignedIn } from "@/components/session/signed-in";
import { SessionProvider } from "@/components/session/use-session";
import { Sheet } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { DealsNav } from "./deals-nav";
import { Logo } from "./logo";
import { DealsProvider, useDeals, type DealsLoad } from "./use-deals";

/**
 * The creator app's frame: an espresso rail with the logo and the deals on
 * desktop (1024px and up); below that, an espresso top bar whose "Deals"
 * button opens the deals as a full-screen sheet. Payouts and Connected
 * accounts join when their specs exist.
 *
 * @param currentDealId - the deal being viewed, marked in the list
 * @param children - the page
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31; DESIGN.md "Navigation", "Layout"
 */
export function AppShell(props: { currentDealId: string | null; children: ReactNode }) {
  return (
    <SessionProvider>
      <DealsProvider>
        <Frame {...props} currentDealId={props.currentDealId}>
          <SignedIn>{props.children}</SignedIn>
        </Frame>
      </DealsProvider>
    </SessionProvider>
  );
}


function Frame({ currentDealId, children }: { currentDealId: string | null; children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const deals = useDeals();

  if (desktop) {
    return (
      <div className="grid min-h-dvh grid-cols-[248px_minmax(0,1fr)]">
        <SkipLink />
        <aside aria-label="Main" className="sticky top-0 flex h-dvh flex-col bg-espresso-deep px-3.5 py-[22px]">
          <span className="px-2.5">
            <Logo />
          </span>
          <span className="mt-[22px] px-0.5">
            <NewDealLink tone="rail" />
          </span>
          {/* A label, not a heading: the nav below is named "Deals", and the page's h1 comes first. */}
          <p aria-hidden="true" className="mx-2.5 mt-[26px] mb-2 text-nav-section font-bold tracking-[0.08em] text-white/70 uppercase">
            Deals
          </p>
          <DealsBody load={deals} currentDealId={currentDealId} tone="rail" />
          {/* SI-FR-11: the creator's name, with Sign out, at the foot of the rail. */}
          <div className="mt-auto pt-4">
            <AccountMenu tone="rail" />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <SkipLink />
      <header className="sticky top-0 z-20 flex items-center justify-between bg-espresso-deep px-4 py-3">
        <Logo compact />
        <Sheet
          title="Deals"
          trigger={
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-nav px-3 text-body-strong font-bold text-white hover:bg-white/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-[18px]">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Deals
            </button>
          }
        >
          <div className="mb-4">
            <NewDealLink tone="sheet" />
          </div>
          <DealsBody load={deals} currentDealId={currentDealId} tone="sheet" />
          <div className="mt-6">
            <AccountMenu tone="sheet" />
          </div>
        </Sheet>
      </header>
      {children}
    </div>
  );
}

function DealsBody({ load, currentDealId, tone }: { load: DealsLoad; currentDealId: string | null; tone: "rail" | "sheet" }) {
  if (load.status === "ready") return <DealsNav deals={load.deals} currentDealId={currentDealId} tone={tone} />;
  const text = tone === "rail" ? "text-white/70" : "text-ink-3";
  if (load.status === "error") return <p className={`px-2.5 text-meta ${text}`}>We couldn’t load your deals.</p>;
  return <p className={`px-2.5 text-meta ${text}`}>Loading your deals…</p>;
}

/** Lets keyboard users jump past the deals to the page (its `<main id="main">`). */
function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-pill focus:bg-surface focus:px-4 focus:text-body-strong focus:font-bold focus:text-espresso focus:shadow-floating-bar"
    >
      Skip to content
    </a>
  );
}

/** BC-FR-01: start a new deal, from the rail (marigold on espresso) or the phone Deals sheet. */
function NewDealLink({ tone }: { tone: "rail" | "sheet" }) {
  return (
    <Link
      href="/deals/new"
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-nav font-extrabold ${
        tone === "rail" ? "bg-marigold text-marigold-ink hover:bg-marigold-chip" : "bg-espresso text-surface hover:bg-espresso-hover"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true" className="size-4">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New deal
    </Link>
  );
}

