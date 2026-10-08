"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SignedIn } from "@/components/session/signed-in";
import { SessionProvider, useSession } from "@/components/session/use-session";
import { Logo } from "@/components/shell/logo";
import { api } from "@/lib/api";
import { DealAhead } from "./deal-ahead";
import { SetupCard } from "./setup-card";

/**
 * `/welcome`, once per account (design C): "Welcome, {first name}", the
 * promise as the deal ahead, the setup card, then "Start your first deal" or
 * "Skip for now", either of which marks the welcome seen. An account that has
 * seen it is sent to its deals.
 *
 * @see docs/specs/sign-in-frd.md SI-FR-03, SI-FR-08 to SI-FR-10, SI-FR-15; design/sign-in/option-c.html
 */
export function WelcomePage() {
  return (
    <SessionProvider>
      <SignedIn>
        <Welcome />
      </SignedIn>
    </SessionProvider>
  );
}

function Welcome() {
  const { load, setMe } = useSession();
  const me = load.status === "signed_in" ? load.me : null;
  const seen = !!me?.welcomed;
  useEffect(() => {
    if (seen) window.location.replace("/deals");
  }, [seen]);
  if (!me) return null;
  if (seen)
    return (
      <main id="main" className="px-4 pt-6 text-ink-2">
        <Link href="/deals" className="font-bold text-espresso underline underline-offset-3">
          Go to your deals
        </Link>
      </main>
    );
  const done = () => void api.markWelcomeSeen();
  return (
    <div className="min-h-dvh bg-ground">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5 md:px-8">
        <Logo tone="light" />
        <span className="text-[14px] text-ink-3">{me.name}</span>
      </header>
      <main id="main" className="mx-auto max-w-[1120px] px-4 pt-7 pb-16 md:px-8 md:pt-11">
        <p className="text-[15px] font-bold text-ink-3">Welcome, {me.name.split(" ")[0]}</p>
        <h1 className="mt-1.5 max-w-[20ch] font-head text-[38px] leading-[1.05] font-extrabold tracking-[-0.02em] lg:text-[56px]">
          Get paid for every brand deal,{" "}
          <span className="bg-[linear-gradient(transparent_62%,var(--color-marigold)_62%,var(--color-marigold)_92%,transparent_92%)] px-[0.06em]">on time</span>.
        </h1>
        <DealAhead />
        <div className="mt-10 grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_300px]">
          <SetupCard me={me} onMe={setMe} />
          <div className="grid gap-2.5 max-lg:text-center">
            <Link
              href="/deals/new"
              onClick={done}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-espresso px-[22px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover"
            >
              Start your first deal
            </Link>
            <Link href="/deals" onClick={done} className="inline-flex min-h-11 items-center justify-center font-bold text-espresso underline decoration-latte-line underline-offset-3 lg:justify-start">
              Skip for now
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
