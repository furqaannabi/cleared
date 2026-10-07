import type { NextStep } from "@/lib/deliverable/next-step";

const UPLOAD_LABEL: Partial<Record<NonNullable<NextStep["action"]>, string>> = {
  upload_draft: "Upload draft",
  upload_new_draft: "Upload new draft",
  upload_again: "Upload again",
};

/**
 * The next-step bar: what happens next and who acts, in one or two
 * sentences, with the one action when it can be taken here. On phones it is
 * fixed to the bottom with a full-width 48px action and shows its lead only;
 * from `md:` up it sits in the page.
 *
 * Upload actions show a button only when an upload handler is given, which the
 * page does only while mocks are on (DC-FR-45); "Try again" retries a check
 * that failed on our side.
 *
 * @param step - the lead, detail and action from the deliverable view
 * @param onTryAgain - retries the check (DC-FR-09)
 * @param pending - a retry is in flight; the button is disabled
 * @param problem - a plain-language problem from the last retry, or null
 * @param secondary - a secondary action shown beside the main one from `md:` up (View brief)
 * @param onUpload - receives the chosen file for an upload action; no upload button without it
 * @param onShowItem - opens the first item needing the creator; makes the lead a button
 * @see docs/specs/creator-draft-check-frd.md DC-FR-30, DC-FR-09; DESIGN.md "Next-step bar"
 */
export function NextStepBar({
  step,
  onTryAgain,
  pending = false,
  problem = null,
  secondary,
  onUpload,
  onShowItem,
}: {
  step: NextStep;
  onTryAgain: () => void;
  pending?: boolean;
  problem?: string | null;
  secondary?: React.ReactNode;
  onUpload?: (file: File) => void;
  onShowItem?: () => void;
}) {
  const canTryAgain = step.action === "try_again";
  const uploadLabel = step.action && onUpload ? UPLOAD_LABEL[step.action] : undefined;
  return (
    <section
      aria-label="What to do next"
      className="fixed inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-lg bg-surface p-3.5 shadow-floating-bar md:static md:z-auto md:bg-latte-wash md:px-5 md:py-4 md:shadow-none"
    >
      <p className="text-[14px] text-ink-2 md:text-body-strong md:font-normal">
        {onShowItem ? (
          // Tapping the lead goes to the item it is about.
          <button
            type="button"
            onClick={onShowItem}
            className="text-left font-bold text-ink underline decoration-latte-line decoration-2 underline-offset-4 hover:decoration-espresso"
          >
            {step.lead}
          </button>
        ) : (
          <b className="text-ink">{step.lead}</b>
        )}
        {step.detail && <span className="hidden md:inline"> {step.detail}</span>}
      </p>
      {problem && (
        <p role="alert" className="text-meta font-semibold text-fail">
          {problem}
        </p>
      )}
      {(canTryAgain || uploadLabel || secondary) && (
        <div className="flex flex-col gap-2.5 md:flex-row md:justify-end">
          {secondary}
          {uploadLabel && (
            // A label styled as the primary button, around a visually hidden file input.
            <label className="relative inline-flex min-h-12 cursor-pointer items-center justify-center rounded-pill bg-espresso px-[18px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-espresso hover:bg-espresso-hover md:min-h-11">
              {uploadLabel}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) onUpload?.(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          )}
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
