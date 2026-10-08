"use client";

import { useState } from "react";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { DealStepHeader } from "@/components/new-deal/deal-step-header";
import { useRefreshDeals } from "@/components/shell/use-deals";
import { inviteView } from "@/lib/invite/invite-view";
import { BeforeYouSend } from "./before-you-send";
import { CreateLinkBar } from "./create-link-bar";
import { LinkPanel } from "./link-panel";
import type { DealInvite } from "@/lib/invite/types";
import type { Save, SaveProblems } from "./save";
import { TermsSheet } from "./terms-sheet";
import { useInvite } from "./use-invite";

/**
 * `/deals/[dealId]/invite`: the terms the brand will see, edited in place as
 * a sponsorship terms sheet, what is left before the link, and the link.
 *
 * @param dealId - the deal
 * @see docs/specs/creator-invite-frd.md IN-FR-01 to IN-FR-22
 */
export function InvitePage({ dealId }: { dealId: string }) {
  const { invite, profile, error, reload, setInvite, setProfile } = useInvite(dealId);
  const refreshDeals = useRefreshDeals();
  const [problems, setProblems] = useState<SaveProblems>({});
  // IN-FR-02: the rail follows the deal's step.
  const takeInvite = (next: DealInvite) => {
    if (invite && next.step !== invite.step) refreshDeals();
    setInvite(next);
  };
  const save: Save = async (key, call, onSaved) => {
    setProblems(({ [key]: _, ...rest }) => (void _, rest));
    const r = await call();
    if (r.ok) onSaved(r.data);
    else setProblems((p) => ({ ...p, [key]: () => void save(key, call, onSaved) }));
    return r.ok;
  };
  const view = invite && profile ? inviteView(invite, profile, new Date()) : null;
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-40 focus:outline-none md:px-6 md:pb-16 lg:px-9">
      {error && <LoadProblem error={error === "not_found" ? "not_found" : "unavailable"} onRetry={reload} />}
      {!view && !error && <PageSkeleton />}
      {invite && profile && view && (
        <>
          <DealStepHeader brand={invite.brandName} title="Invite" stage="invite" />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
            <TermsSheet invite={invite} profile={profile} view={view} save={save} problems={problems} onInvite={takeInvite} onProfile={setProfile} />
            <div className={`grid gap-4 lg:sticky lg:top-6 ${invite.link ? "order-first lg:order-none" : ""}`}>
              {invite.link ? (
                <LinkPanel invite={{ ...invite, link: invite.link }} save={save} problems={problems} onInvite={takeInvite} />
              ) : (
                <>
                  <BeforeYouSend invite={invite} view={view} save={save} problems={problems} onInvite={takeInvite} onProfile={setProfile} />
                  <CreateLinkBar invite={invite} view={view} paypalEmail={profile.paypalEmail} save={save} problems={problems} onInvite={takeInvite} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
