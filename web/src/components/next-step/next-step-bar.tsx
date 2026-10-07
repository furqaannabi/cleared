import type { NextStep } from "@/lib/deliverable/next-step";

/**
 * The next-step bar: what happens next and who acts, in one or two
 * sentences, with the one action when it can be taken here. On phones it is
 * fixed to the bottom with a full-width 48px action and shows its lead only;
 * from `md:` up it sits in the page.
 *
 * Upload actions show no button until the upload flow exists (creator draft
 * check FRD, Open items); "Try again" retries a check that failed on our side.
 *
 * @param step - the lead, detail and action from the deliverable view
 * @param onTryAgain - retries the check (DC-FR-09)
 * @param pending - a retry is in flight; the button is disabled
 * @param problem - a plain-language problem from the last retry, or null
 * @param secondary - a secondary action shown beside the main one from `md:` up (View brief)
 * @see docs/specs/creator-draft-check-frd.md DC-FR-30, DC-FR-09; DESIGN.md "Next-step bar"
 */
export function NextStepBar({
  step,
  onTryAgain,
  pending = false,
  problem = null,
  secondary,
}: {
  step: NextStep;
  onTryAgain: () => void;
  pending?: boolean;
  problem?: string | null;
  secondary?: React.ReactNode;
}) {
  const canTryAgain = step.action === "try_again";
  return (
    <section
      aria-label="What to do next"
      className="fixed inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-lg bg-surface p-3.5 shadow-floating-bar md:static md:z-auto md:bg-latte-wash md:px-5 md:py-4 md:shadow-none"
    >
      <p className="text-[14px] text-ink-2 md:text-body-strong md:font-normal">
        <b className="text-ink">{step.lead}</b>
        {step.detail && <span className="hidden md:inline"> {step.detail}</span>}
      </p>
      {problem && (
        <p role="alert" className="text-meta font-semibold text-fail">
          {problem}
        </p>
      )}
      {(canTryAgain || secondary) && (
        <div className="flex flex-col gap-2.5 md:flex-row md:justify-end">
          {secondary}
          {canTryAgain && (
            <button
              type="button"
              onClick={onTryAgain}
              disabled={pending}
              aria-busy={pending || undefined}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-espresso px-[18px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] transition-colors hover:bg-espresso-hover active:translate-y-px disabled:cursor-wait disabled:opacity-70 md:min-h-11"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
