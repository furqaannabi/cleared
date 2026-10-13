"use client";

import type { BrandReviewView } from "@/lib/brand-review/review-view";
import { SendBar } from "@/components/ui/send-bar";
import type { ReviewActions } from "./use-review-actions";

/**
 * The brand's unsent objections in the send bar, once one is saved: "{n}
 * objections for {creator}", the items, "Send to {creator}", and the
 * confirmation in the bar. Nothing once none are saved or the window has no
 * objections to take.
 *
 * @param view - the post's review view
 * @param actions - the brand's answers on this post
 * @param creator - the creator, named on Send
 * @see docs/specs/brand-review-frd.md RW-FR-17, RW-FR-18 (1.3)
 */
export function ObjectionsBar({ view, actions, creator }: { view: BrandReviewView; actions: ReviewActions; creator: string }) {
  const n = actions.objections.length;
  if (!view.actions.object || n === 0) return null;
  const nameOf = (id: string) => view.items.find((i) => i.id === id)?.name ?? "An item";
  const count = `${n} ${n === 1 ? "objection" : "objections"}`;
  return (
    <SendBar
      label="Your unsent objections"
      summary={`${count} for ${creator}`}
      notes={actions.objections.map((o) => ({ key: o.itemId, about: nameOf(o.itemId), note: o.note }))}
      sendLabel={`Send to ${creator}`}
      confirming={actions.confirming === "send"}
      question={`Send ${count}?`}
      detail={` The clock stops and ${creator} makes a new draft. You can still approve this draft until ${creator} sends one.`}
      busy={actions.busy}
      problem={actions.problemItem ? null : actions.problem}
      onOpen={() => actions.confirm("send")}
      onCancel={() => actions.confirm(null)}
      onYes={actions.send}
    />
  );
}
