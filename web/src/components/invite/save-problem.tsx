/**
 * A failed save beside its field: "We couldn't save that." and Try again
 * (IN-FR-15). Announced politely.
 *
 * @param retry - tries the same change again, or undefined when nothing failed
 */
export function SaveProblem({ retry }: { retry: (() => void) | undefined }) {
  return (
    <p role="status" className="text-meta font-bold text-fail empty:hidden">
      {retry && (
        <>
          We couldn’t save that.{" "}
          <button type="button" onClick={retry} className="min-h-11 font-bold text-espresso underline underline-offset-3">
            Try again
          </button>
        </>
      )}
    </p>
  );
}
