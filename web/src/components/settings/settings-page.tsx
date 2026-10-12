"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSession } from "@/components/session/use-session";
import { api } from "@/lib/api";
import { settingsView } from "@/lib/settings/settings-view";
import { AccountRows } from "./account-rows";
import { DeleteAccount } from "./delete-account";
import { GettingPaid } from "./getting-paid";
import { TEXT_LINK } from "./styles";

/**
 * The creator's settings (design A, the quiet list, with the profile band):
 * who is signed in, where the money goes, which accounts Cleared reads,
 * Sign out, and Delete account apart at the end.
 *
 * @see docs/specs/settings-frd.md ST-FR-01 to ST-FR-14 (1.3); design/settings/option-a.html
 */
export function SettingsPage() {
  const { load, setMe } = useSession();
  if (load.status !== "signed_in") return null;
  const me = load.me;
  const view = settingsView(me);
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-16 focus:outline-none md:px-6 md:pt-7 lg:px-9">
      <h1 className="font-head text-page-title-phone font-bold md:text-page-title">Settings</h1>
      <div className="mt-3.5 flex items-center gap-3.5 rounded-[20px] bg-latte p-[18px]">
        <span aria-hidden="true" className="grid size-[52px] flex-none place-items-center rounded-full bg-marigold text-[18px] font-bold text-marigold-ink">
          {view.initials}
        </span>
        <div className="min-w-0">
          <p className="font-head text-[21px] leading-tight font-bold">{view.name}</p>
          {view.signedInAs && <p className="text-[13.5px] break-words text-ink-3">{view.signedInAs}</p>}
        </div>
      </div>
      <div className="mt-4 rounded-[20px] border border-line bg-surface px-[18px] py-1.5 shadow-panel md:px-[26px] md:py-2">
        <Section label="Getting paid" purpose="Where Cleared sends your payouts.">
          <GettingPaid me={me} onMe={setMe} />
        </Section>
        <Section label="Connected accounts" purpose="Cleared only reads them, to check your posts.">
          <AccountRows rows={view.accounts} onMe={setMe} />
        </Section>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-5">
        <button
          type="button"
          onClick={async () => {
            await api.signOut();
            window.location.assign("/");
          }}
          className={TEXT_LINK}
        >
          Sign out
        </button>
        {/* ST-FR-09 (1.2, 1.4). */}
        <Link href="/privacy" className={TEXT_LINK}>
          Privacy policy
        </Link>
        <Link href="/terms" className={TEXT_LINK}>
          Terms
        </Link>
      </p>
      <DeleteAccount />
    </main>
  );
}

/** One section: its label and purpose on the left from `md:` (above on phones), its rows on the right. */
function Section({ label, purpose, children }: { label: string; purpose: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="grid gap-2.5 border-t border-line-soft py-[18px] first:border-t-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
      <div>
        <h2 className="text-[12px] font-bold text-ink-3 md:text-[14px] md:text-ink">{label}</h2>
        <p className="hidden max-w-[24ch] text-[13px] text-ink-3 md:block">{purpose}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
