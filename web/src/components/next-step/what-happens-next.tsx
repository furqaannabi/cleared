import type { NextStep } from "@/lib/deliverable/next-step";

/**
 * Phones: the next step's whole explanation on the page, since the fixed bar
 * shows only its lead. The lead in bold, then the rest. No icon and no button:
 * the action stays in the bar. Renders nothing when there is no second sentence.
 *
 * @param step - the next step from the deliverable view
 * @see docs/specs/creator-draft-check-frd.md DC-FR-47, DC-FR-30
 */
export function WhatHappensNext({ step }: { step: NextStep }) {
  if (!step.detail) return null;
  return (
    <section aria-label="What happens next" className="rounded-md bg-latte-wash px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
      <strong className="font-bold text-ink">{step.lead}</strong> {step.detail}
    </section>
  );
}
