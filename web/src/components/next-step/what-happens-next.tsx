import type { NextStep } from "@/lib/deliverable/next-step";

/**
 * Phones: the page's one status panel, above the player. The new run's
 * summary first when there is one (DC-FR-48), then the next step's lead in
 * bold (a link to the first item that needs the creator, when there is one)
 * and the rest of the explanation. No icon and no button of its own: the
 * fixed bar holds only the action.
 *
 * @param step - the next step from the deliverable view
 * @param recap - the run summary line ("Your fix worked · 1 item still needs you") and its tone, or nothing
 * @param onShowItem - goes to the first item that needs the creator; makes the lead a link
 * @see docs/specs/creator-draft-check-frd.md DC-FR-47, DC-FR-48, DC-FR-30
 */
export function WhatHappensNext({
  step,
  recap,
  onShowItem,
}: {
  step: NextStep;
  recap?: { text: string; tone: "pass" | "neutral" } | null;
  onShowItem?: () => void;
}) {
  return (
    <section aria-label="What happens next" className="rounded-md bg-latte-wash px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
      {/* Pass green only when the fix worked and nothing got worse (DC-FR-48). */}
      {recap && <p className={`mb-1 font-bold ${recap.tone === "pass" ? "text-pass" : "text-ink"}`}>{recap.text}</p>}
      <p>
        {onShowItem ? (
          <button
            type="button"
            onClick={onShowItem}
            className="relative text-left font-bold text-ink underline decoration-latte-line decoration-2 underline-offset-4 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:decoration-espresso"
          >
            {step.lead}
          </button>
        ) : (
          <strong className="font-bold text-ink">{step.lead}</strong>
        )}
        {step.detail && ` ${step.detail}`}
      </p>
    </section>
  );
}
