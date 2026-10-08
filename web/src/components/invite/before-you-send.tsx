"use client";

import { Seal } from "@/components/ui/seal";
import { api } from "@/lib/api";
import type { InviteView } from "@/lib/invite/invite-view";
import type { CreatorProfile, DealInvite } from "@/lib/invite/types";
import { EmailField } from "./email-field";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

const WHY: Record<"youtube" | "instagram", string> = {
  youtube: "Cleared reads it to check the live video.",
  instagram: "Professional accounts only. Cleared reads it to check the live Reel.",
};

/**
 * "Before you send": what must be in place before the brand's link can be
 * created, each ticked off as it is done, with Connect for a missing account
 * (mocked; no real sign-in yet), and the brand's optional email.
 *
 * @param invite - the deal's invite terms
 * @param view - the invite view model
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite a saved change returned
 * @param onProfile - takes the profile a saved change returned
 * @see docs/specs/creator-invite-frd.md IN-FR-09 to IN-FR-11, IN-FR-13, IN-FR-16
 */
export function BeforeYouSend({
  invite,
  view,
  save,
  problems,
  onInvite,
  onProfile,
}: {
  invite: DealInvite;
  view: InviteView;
  save: Save;
  problems: SaveProblems;
  onInvite: (invite: DealInvite) => void;
  onProfile: (profile: CreatorProfile) => void;
}) {
  return (
    <section aria-labelledby="before-heading" className="grid gap-3 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 id="before-heading" className="font-head text-[17px] font-bold">
        Before you send
      </h2>
      <ul className="grid gap-3">
        {view.checks.map((c) => (
          <li key={c.key} className="grid grid-cols-[22px_1fr] items-start gap-2.5 text-[14.5px]">
            {c.done ? (
              <Seal fillClassName="fill-latte" className="size-[22px] text-espresso">
                <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </Seal>
            ) : (
              <span aria-hidden="true" className="mt-0.5 size-[18px] rounded-full border-2 border-latte-line" />
            )}
            <div>
              <span className={c.done ? "text-ink-3" : "font-bold"}>
                {c.label}
                <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
              </span>
              {!c.done && (c.key === "youtube" || c.key === "instagram") && (
                <>
                  <p className="text-meta text-ink-3">{WHY[c.key]}</p>
                  <button
                    type="button"
                    onClick={() => save(`connect:${c.key}`, () => api.connectAccount(c.key as "youtube" | "instagram"), onProfile)}
                    className="mt-2 inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso hover:bg-latte-wash"
                  >
                    {c.label}
                  </button>
                  <SaveProblem retry={problems[`connect:${c.key}`]} />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-line-soft pt-3">
        <EmailField
          label={`${invite.brandName}’s email (optional)`}
          value={invite.brandEmail}
          hint="We’ll email them the link too."
          optional
          onSave={(brandEmail) => save("brandEmail", () => api.updateInvite(invite.dealId, { brandEmail }), onInvite)}
        />
        <SaveProblem retry={problems.brandEmail} />
      </div>
    </section>
  );
}
