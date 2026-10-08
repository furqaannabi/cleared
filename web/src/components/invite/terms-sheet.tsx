"use client";

import { useRouter } from "next/navigation";
import { useRefreshDeals } from "@/components/shell/use-deals";
import { api } from "@/lib/api";
import { formatAmount } from "@/lib/invite/amount";
import type { InviteView } from "@/lib/invite/invite-view";
import type { CreatorProfile, DealInvite } from "@/lib/invite/types";
import { ConfirmAction } from "./confirm-action";
import { EmailField } from "./email-field";
import { PaymentRules } from "./payment-rules";
import { PostLine } from "./post-line";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

/**
 * The sponsorship terms sheet: what the brand sees when it opens the link
 * (design B, design/invite/option-b.html). The creator and brand, a line per
 * post with its deadline and amount, the total, the PayPal email and the four
 * payment rules.
 *
 * @param invite - the deal's invite terms
 * @param profile - the creator's profile
 * @param view - the invite view model
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite a saved change returned
 * @param onProfile - takes the profile a saved change returned
 * @see docs/specs/creator-invite-frd.md IN-FR-04 to IN-FR-08, IN-FR-12, IN-FR-14
 */
export function TermsSheet({
  invite,
  profile,
  view,
  save,
  problems,
  onInvite,
  onProfile,
}: {
  invite: DealInvite;
  profile: CreatorProfile;
  view: InviteView;
  save: Save;
  problems: SaveProblems;
  onInvite: (invite: DealInvite) => void;
  onProfile: (profile: CreatorProfile) => void;
}) {
  const router = useRouter();
  const refreshDeals = useRefreshDeals();
  const locked = invite.step === "waiting_for_brand";
  return (
    <section
      aria-labelledby="terms-heading"
      className="relative overflow-hidden rounded-t-[6px] rounded-b-[20px] border border-line bg-surface px-[18px] pt-[26px] pb-6 shadow-panel before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-marigold md:px-8 md:pt-9 md:pb-8"
    >
      {locked && (
        <p className="mb-3 text-meta font-bold text-ink-2">
          Sent to {invite.brandName} · waiting for them to confirm the checklist and approve the holds
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="terms-heading" className="font-head text-[26px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[30px]">
            Sponsorship terms
          </h2>
          <p className="mt-1 text-[14px] text-ink-3">{locked ? "Locked while the link is open" : `What ${invite.brandName} sees when they open your link`}</p>
        </div>
        <div className="max-w-sm">
          {locked ? (
            <ConfirmAction
              label="Change terms"
              warning={`${invite.brandName}’s link will stop working. You’ll make a new one when you’re done.`}
              yes="Yes, change terms"
              no="Cancel"
              onConfirm={() => save("changeTerms", () => api.turnOffInviteLink(invite.dealId), onInvite)}
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                save(
                  "reopen",
                  () => api.reopenChecklist(invite.dealId),
                  () => {
                    refreshDeals();
                    router.push(`/deals/${encodeURIComponent(invite.dealId)}/checklist`);
                  },
                )
              }
              className="inline-flex min-h-11 items-center text-[14px] font-bold text-espresso underline underline-offset-3"
            >
              Edit checklist
            </button>
          )}
          <SaveProblem retry={problems[locked ? "changeTerms" : "reopen"]} />
        </div>
      </div>
      <dl className="my-[22px] grid grid-cols-2 gap-4 text-[15px]">
        <div>
          <dt className="text-[12.5px] font-bold text-ink-4">Creator</dt>
          <dd className="font-bold">{profile.name}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-bold text-ink-4">Brand</dt>
          <dd className="font-bold">{invite.brandName}</dd>
        </div>
      </dl>
      <div aria-hidden="true" className="hidden gap-4 pb-2 text-[12.5px] font-extrabold text-ink-4 md:grid md:grid-cols-[minmax(0,1fr)_200px_150px]">
        <span>Post</span>
        <span>{locked ? "Deadline" : "Days after the hold"}</span>
        <span className="text-right">Amount</span>
      </div>
      <div className="border-t border-ink">
        {view.posts.map((post) => (
          <PostLine key={post.deliverableId} dealId={invite.dealId} post={post} save={save} problems={problems} onInvite={onInvite} locked={locked} />
        ))}
      </div>
      {view.total && (
        <p className="flex items-baseline justify-between gap-3 pt-4 pb-1">
          <span className="font-bold">Total, held as one hold per post</span>
          <b className="font-head text-[30px] font-extrabold tracking-[-0.02em]">{formatAmount(view.total)}</b>
        </p>
      )}
      {locked ? (
        <p className="mt-[18px] text-[14.5px] text-ink-2">
          Paid to your PayPal: <b className="text-ink">{profile.paypalEmail}</b>
        </p>
      ) : (
        <div className="mt-[18px] max-w-[420px]">
          <EmailField
            label="Your PayPal email"
            value={profile.paypalEmail}
            hint="Only you see this. Check it: a payment to the wrong email can’t be pulled back."
            onSave={(email) => email && save("paypal", () => api.setPaypalEmail(email), onProfile)}
          />
          <SaveProblem retry={problems.paypal} />
        </div>
      )}
      <PaymentRules brand={invite.brandName} />
    </section>
  );
}
