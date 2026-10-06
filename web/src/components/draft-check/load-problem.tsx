import type { ApiError } from "@/lib/api";

/**
 * What the page shows when its data can't be shown: the same plain page for
 * a deal that doesn't exist or isn't yours (DC-FR-38), and a retry for
 * anything else (DC-FR-39).
 *
 * @param error - why the load failed
 * @param onRetry - loads the page again
 */
export function LoadProblem({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  if (error === "not_found") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em]">We couldn’t find this deal</h1>
        <p className="mt-2 text-ink-2">The link may be wrong, or the deal may not be one of yours.</p>
      </div>
    );
  }
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <p className="text-item-title font-bold">We couldn’t load this deliverable.</p>
      <p className="mt-2 text-ink-2">It may be your connection or a problem on our side.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] transition-colors hover:bg-espresso-hover active:translate-y-px"
      >
        Try again
      </button>
    </div>
  );
}
