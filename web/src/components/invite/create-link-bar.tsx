import { api } from "@/lib/api";
import { formatAmount } from "@/lib/invite/amount";
import type { InviteView } from "@/lib/invite/invite-view";
import type { DealInvite } from "@/lib/invite/types";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

/**
 * "Create link for {brand}", held back until every term is in place, with the
 * first thing left and how many more. While answering the brand's notes it is
 * "Send updated terms to {brand}" instead, held back the same way (CH-FR-24).
 * Fixed to the bottom on phones.
 *
 * @param invite - the deal's invite terms
 * @param view - the invite view model
 * @param paypalEmail - where the creator is paid, repeated in the summary
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite with its new link
 * @see docs/specs/creator-invite-frd.md IN-FR-16
 */
export function CreateLinkBar({
  invite,
  view,
  paypalEmail,
  save,
  problems,
  onInvite,
}: {
  invite: DealInvite;
  view: InviteView;
  paypalEmail?: string;
  save: Save;
  problems: SaveProblems;
  onInvite: (invite: DealInvite) => void;
}) {
  const update = invite.step === "changes_requested";
  return (
    <section
      aria-label={update ? "Send updated terms" : "Create link"}
      className="fixed inset-x-3 bottom-3 z-10 grid gap-2 rounded-lg bg-surface p-3.5 shadow-floating-bar lg:static lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      {view.canCreate && view.total && (
        <p className="text-[14px] text-ink-2">{`${formatAmount(view.total)} in total, paid to ${paypalEmail}.`}</p>
      )}
      {view.left && (
        <p className="text-[14px] text-ink-2">
          <b className="text-ink">{view.left.first}</b>
          {view.left.more > 0 && <> {`and ${view.left.more} more`}</>}
        </p>
      )}
      <button
        type="button"
        aria-disabled={!view.canCreate || undefined}
        onClick={() =>
          view.canCreate && save("link", () => (update ? api.sendUpdatedTerms(invite.dealId) : api.createInviteLink(invite.dealId)), onInvite)
        }
        className="inline-flex min-h-12 items-center justify-center rounded-pill bg-espresso px-6 text-body-strong font-bold text-surface hover:bg-espresso-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {update ? `Send updated terms to ${invite.brandName}` : `Create link for ${invite.brandName}`}
      </button>
      <SaveProblem retry={problems.link} />
    </section>
  );
}
