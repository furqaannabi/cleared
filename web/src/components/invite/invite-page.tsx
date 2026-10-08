"use client";

import { useState } from "react";
import { CancelDeal } from "@/components/cancel/cancel-deal";
import { CancelledDeal } from "@/components/cancel/cancelled-deal";
import { PostCancelSlot } from "@/components/cancel/post-cancel-slot";
import { api } from "@/lib/api";
import type { DealCancelPost } from "@/lib/cancel/deal-cancel-view";
import { LoadProblem } from "@/components/draft-check/load-problem";
import { PageSkeleton } from "@/components/draft-check/page-skeleton";
import { DealStepHeader } from "@/components/new-deal/deal-step-header";
import { useRefreshDeals } from "@/components/shell/use-deals";
import { stepLinks } from "@/lib/checklist-builder/step-links";
import { inviteView } from "@/lib/invite/invite-view";
import { BeforeYouSend } from "./before-you-send";
import { BrandChanges } from "./brand-changes";
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
  // CN-FR-01, CN-FR-02, CN-FR-14: cancelling from the invite page, one post or the deal.
  const cancelPosts: DealCancelPost[] = (invite?.posts ?? []).map((p) => ({
    deliverableId: p.deliverableId,
    platform: p.platform,
    amount: p.amount ?? "0.00",
    held: p.hold?.state === "held",
    cancel: p.cancel,
  }));
  const allCancelled = !!invite && invite.posts.every((p) => p.cancelled);
  const cancelOne = (deliverableId: string, note?: string) => api.cancelInvitePost(invite!.dealId, deliverableId, note);
  const afterCancel = (next: DealInvite) => {
    setInvite(next);
    refreshDeals();
  };
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-40 focus:outline-none md:px-6 md:pb-16 lg:px-9">
      {error && <LoadProblem error={error === "not_found" ? "not_found" : "unavailable"} onRetry={reload} />}
      {!view && !error && <PageSkeleton />}
      {invite && profile && view && (
        <>
          <DealStepHeader
            brand={invite.brandName}
            dealId={invite.dealId}
            title="Invite"
            stage="invite"
            links={stepLinks({ id: invite.dealId, step: invite.step, reading: "done" })}
          />
          {allCancelled && (
            <CancelledDeal
              cancels={invite.posts.map((p) => ({ cancelled: p.cancelled!, held: p.hold?.state === "held" }))}
              side="creator"
              brandName={invite.brandName}
              creatorName={profile.name}
            />
          )}
          {!allCancelled && invite.step === "changes_requested" && <BrandChanges invite={invite} save={save} problems={problems} onInvite={takeInvite} />}
          {!allCancelled && <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
            <TermsSheet
              invite={invite}
              profile={profile}
              view={view}
              save={save}
              problems={problems}
              onInvite={takeInvite}
              onProfile={setProfile}
              renderCancel={(id) => {
                const p = invite.posts.find((x) => x.deliverableId === id)!;
                return (
                  <PostCancelSlot
                    post={cancelPosts.find((x) => x.deliverableId === id)!}
                    cancelled={p.cancelled}
                    side="creator"
                    brandName={invite.brandName}
                    creatorName={profile.name}
                    sendOne={cancelOne}
                    onUpdated={afterCancel}
                  />
                );
              }}
            />
            <div className={`grid gap-4 lg:sticky lg:top-6 ${invite.link && invite.step === "waiting_for_brand" ? "order-first lg:order-none" : ""}`}>
              {invite.step === "agreed" ? null : invite.link && invite.step !== "changes_requested" ? (
                <LinkPanel invite={{ ...invite, link: invite.link }} save={save} problems={problems} onInvite={takeInvite} />
              ) : (
                <>
                  <BeforeYouSend invite={invite} view={view} save={save} problems={problems} onInvite={takeInvite} onProfile={setProfile} />
                  <CreateLinkBar invite={invite} view={view} paypalEmail={profile.paypalEmail} save={save} problems={problems} onInvite={takeInvite} />
                </>
              )}
              {/* CN-FR-02: the deal's cancel, under the side panel. */}
              <CancelDeal posts={cancelPosts} side="creator" brandName={invite.brandName} creatorName={profile.name} sendOne={cancelOne} onUpdated={afterCancel} />
            </div>
          </div>}
        </>
      )}
    </main>
  );
}
