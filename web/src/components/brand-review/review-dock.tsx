"use client";

import type { BrandReviewView } from "@/lib/brand-review/review-view";
import { OUTLINE, PRIMARY } from "./styles";
import type { ReviewActions } from "./use-review-actions";

/**
 * Phones and tablets: the brand's answer in a dock fixed to the bottom, in
 * reach while reading the checklist. It opens the confirmation in "Your
 * review" and brings it into view. Not shown from `lg:`, where the panel
 * sits beside the work.
 *
 * @param view - the post's review view
 * @param actions - the brand's answers on this post
 * @param creator - the creator, named on Send
 * @see docs/specs/brand-review-frd.md RW-FR-29
 */
export function ReviewDock({ view, actions, creator }: { view: BrandReviewView; actions: ReviewActions; creator: string }) {
  if (!view.actions.approve && !view.actions.approveAnyway) return null;
  if (actions.confirming) return null;
  const n = actions.objections.length;
  const open = (what: "approve" | "send") => {
    actions.confirm(what);
    document.getElementById("your-review")?.scrollIntoView?.({ block: "start" });
  };
  return (
    <div data-testid="review-dock" className="fixed inset-x-3 bottom-3 z-10 grid gap-2 rounded-[16px] bg-surface p-3.5 shadow-floating-bar lg:hidden">
      {view.timeLeft && (
        <p className="text-[13.5px] text-ink-2">
          <b className="font-head text-[20px] font-extrabold text-ink tabular-nums">{view.timeLeft.text}</b> left{n ? ` · ${n} saved` : ""}
        </p>
      )}
      <div className="flex gap-2 [&>*]:flex-1">
        <button type="button" onClick={() => open("approve")} className={OUTLINE} aria-label={view.actions.approveAnyway ? "Approve this draft anyway" : "Approve draft"}>
          Approve
        </button>
        {n > 0 && (
          <button type="button" onClick={() => open("send")} className={`${PRIMARY} min-h-11 text-[14.5px]`} aria-label={`Send ${n} to ${creator}`}>
            Send {n}
          </button>
        )}
      </div>
    </div>
  );
}
