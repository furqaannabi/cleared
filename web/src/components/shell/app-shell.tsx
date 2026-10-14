"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { AccountMenu } from "@/components/session/account-menu";
import { SignedIn } from "@/components/session/signed-in";
import { SessionProvider } from "@/components/session/use-session";
import { Sheet } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useRailFolded } from "@/lib/hooks/use-rail-folded";
import { DealsNav, NeedsYouDot } from "./deals-nav";
import { usePayments } from "@/components/home/use-payments";
import { needsYouIds } from "@/lib/home/deal-groups";
import { Logo } from "./logo";
import { RailTip } from "./rail-tip";
import { DealsProvider, useDeals, type DealsLoad } from "./use-deals";

/**
 * The creator app's frame: an espresso rail with the logo and the deals on
 * desktop (1024px and up); below that, an espresso top bar whose "Deals"
 * button opens the deals as a full-screen sheet. "Overview" and "Payments"
 * are the first links after New deal in both.
 *
 * @param currentDealId - the deal being viewed, marked in the list
 * @param page - "overview" or "payments" on those pages, to mark its link current
 * @param children - the page
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31; docs/specs/creator-home-frd.md HM-FR-01, HM-FR-23; DESIGN.md "Navigation", "Layout"
 */
export function AppShell(props: { currentDealId: string | null; page?: Page; children: ReactNode }) {
  return (
    <SessionProvider>
      <DealsProvider>
        <Frame currentDealId={props.currentDealId} page={props.page ?? null}>
          <SignedIn>{props.children}</SignedIn>
        </Frame>
      </DealsProvider>
    </SessionProvider>
  );
}


type Page = "overview" | "payments";

function Frame({ currentDealId, page, children }: { currentDealId: string | null; page: Page | null; children: ReactNode }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const deals = useDeals();
  // DC-FR-31 (1.26): Overview's rule, so stuck payouts count; payments that fail to load just add none.
  const { load: payments } = usePayments();
  const needsYou = useMemo(
    () => (deals.status === "ready" ? needsYouIds(deals.deals, payments.status === "ready" ? payments.rows : []) : new Set<string>()),
    [deals, payments],
  );
  // DC-FR-55 (1.23): the rail can fold to its icons, for a wider page.
  const [folded, toggleFolded] = useRailFolded();

  if (desktop) {
    return (
      <div
        className={`grid min-h-dvh transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${folded ? "grid-cols-[64px_minmax(0,1fr)]" : "grid-cols-[248px_minmax(0,1fr)]"}`}
      >
        <SkipLink />
        <aside aria-label="Main" className={`sticky top-0 z-20 flex h-dvh flex-col bg-espresso-deep py-[22px] ${folded ? "px-2" : "px-3.5"}`}>
          {/* DC-FR-31 (1.20): the logo goes to the landing page; DC-FR-55 (1.24): the fold beside it, or under the seal when folded. */}
          <div className={folded ? "grid justify-items-center gap-2" : "flex items-center justify-between gap-2"}>
            <Link href="/" aria-label="Sponing, home page" className={`rounded-nav ${folded ? "px-1.5" : "px-2.5"}`}>
              <Logo mark={folded} />
            </Link>
            <FoldButton folded={folded} onToggle={toggleFolded} />
          </div>
          <span className={`${folded ? "mt-3" : "mt-[22px]"} grid gap-1 px-0.5`}>
            <NewDealLink tone="rail" slim={folded} />
            <PageLinks tone="rail" page={page} slim={folded} />
          </span>
          {/* A label, not a heading: the nav below is named "Deals", and the page's h1 comes first. Set well apart from the links above. */}
          {folded ? (
            <span aria-hidden="true" className="mx-2 mt-10 mb-2 border-t border-white/12" />
          ) : (
            <p aria-hidden="true" className="mx-2.5 mt-10 mb-2 text-nav-section font-bold tracking-[0.08em] text-white/70 uppercase">
              Deals
            </p>
          )}
          <DealsBody load={deals} currentDealId={currentDealId} tone="rail" slim={folded} needsYou={needsYou} />
          {/* SI-FR-11: the creator's name, with Sign out, at the foot of the rail. */}
          <div className="mt-auto pt-4">
            <AccountMenu tone="rail" slim={folded} />
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
        <Link href="/" aria-label="Sponing, home page" className="rounded-nav">
          <Logo compact />
        </Link>
        <Sheet
          title="Deals"
          trigger={
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-nav px-3 text-body-strong font-bold text-white hover:bg-white/10">
              <span className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-[18px]">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {/* DC-FR-31 (1.26): any deal that needs the creator. */}
                {needsYou.size > 0 && <NeedsYouDot tone="rail" className="-top-1 -right-1.5" />}
              </span>
              Deals
              {needsYou.size > 0 && <span className="sr-only">, a deal needs you</span>}
            </button>
          }
        >
          <div className="mb-8 grid gap-1">
            <NewDealLink tone="sheet" />
            <PageLinks tone="sheet" page={page} />
          </div>
          <DealsBody load={deals} currentDealId={currentDealId} tone="sheet" needsYou={needsYou} />
          <div className="mt-6">
            <AccountMenu tone="sheet" />
          </div>
        </Sheet>
      </header>
      {children}
    </div>
  );
}

function DealsBody({
  load,
  currentDealId,
  tone,
  slim = false,
  needsYou,
}: {
  load: DealsLoad;
  currentDealId: string | null;
  tone: "rail" | "sheet";
  slim?: boolean;
  needsYou: ReadonlySet<string>;
}) {
  if (load.status === "ready") return <DealsNav deals={load.deals} currentDealId={currentDealId} tone={tone} slim={slim} needsYou={needsYou} />;
  // Folded, the rail has no room for these words; the page says what's wrong.
  if (slim) return null;
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

/** HM-FR-01, HM-FR-23, DC-FR-31 (1.22): Overview, then Payments, each marked current on its page. */
function PageLinks({ tone, page, slim = false }: { tone: "rail" | "sheet"; page: Page | null; slim?: boolean }) {
  return (
    <>
      <PageLink tone={tone} slim={slim} href="/deals" current={page === "overview"} icon={<path d="M5 20V12M12 20V5M19 20v-9" />}>
        Overview
      </PageLink>
      <PageLink
        tone={tone}
        slim={slim}
        href="/payments"
        current={page === "payments"}
        icon={
          <>
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M3 10h18M7 15h4" />
          </>
        }
      >
        Payments
      </PageLink>
    </>
  );
}

function PageLink({
  tone,
  href,
  current,
  icon,
  slim = false,
  children,
}: {
  tone: "rail" | "sheet";
  href: string;
  current: boolean;
  icon: ReactNode;
  slim?: boolean;
  children: string;
}) {
  const rail = tone === "rail";
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-2.5 rounded-nav text-body-strong font-bold ${slim ? "justify-center px-0" : "px-2.5"} ${
        rail ? `text-white/95 hover:bg-white/8 ${current ? "bg-white/14 text-white" : ""}` : `text-ink hover:bg-latte-wash ${current ? "bg-latte" : ""}`
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px]">
        {icon}
      </svg>
      {/* DC-FR-55: folded, the name is for screen readers and the tooltip. */}
      <span className={slim ? "sr-only" : undefined}>{children}</span>
      {slim && <RailTip>{children}</RailTip>}
    </Link>
  );
}

/** BC-FR-01: start a new deal, a row like Overview and Payments in the rail and the phone Deals sheet. */
function NewDealLink({ tone, slim = false }: { tone: "rail" | "sheet"; slim?: boolean }) {
  return (
    <PageLink tone={tone} slim={slim} href="/deals/new" current={false} icon={<path d="M12 5v14M5 12h14" />}>
      New deal
    </PageLink>
  );
}

/**
 * Folds the desktop rail to its icons and back (DC-FR-55), at the top of the
 * rail (1.24): an icon named for what it does next, shown as a tooltip, with
 * `aria-expanded` saying whether the rail is open.
 */
function FoldButton({ folded, onToggle }: { folded: boolean; onToggle: () => void }) {
  const label = folded ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!folded}
      aria-label={label}
      className="group relative grid size-11 flex-none place-items-center rounded-nav text-white/70 hover:bg-white/8 hover:text-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[18px]">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d={folded ? "M13 10l2 2-2 2" : "M15 10l-2 2 2 2"} />
      </svg>
      <RailTip>{label}</RailTip>
    </button>
  );
}
