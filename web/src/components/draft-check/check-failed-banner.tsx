import { Seal } from "@/components/ui/seal";
import type { CheckFailedBanner as Banner } from "@/lib/deliverable/next-step";

/**
 * Full-width banner when a check couldn't run, between the header and the
 * results. Says what happened, that the hold is still in place (at every
 * width), and which run's results are shown below. A file problem (the
 * creator's to fix) is fail-tinted with a cross seal; a problem on Cleared's
 * side is a plain panel with a grey refresh seal. No button: the next-step
 * bar carries the action.
 *
 * @param banner - the banner from the deliverable view
 * @see docs/specs/creator-draft-check-frd.md DC-FR-08, DC-FR-09, DC-FR-28; DESIGN.md "Check failed banner"
 */
export function CheckFailedBanner({ banner }: { banner: Banner }) {
  const file = banner.kind === "file";
  return (
    <section
      aria-labelledby="check-failed-heading"
      data-kind={banner.kind}
      className={`mt-5 grid grid-cols-[32px_1fr] items-start gap-3 rounded-lg border px-4 py-3.5 md:grid-cols-[40px_1fr] md:gap-3.5 md:px-5 md:py-4 ${
        file ? "border-fail-line bg-fail-tint" : "border-line bg-surface"
      }`}
    >
      <Seal fillClassName={file ? "fill-fail-wash" : "fill-waiting-wash"} className="size-8 md:size-10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-full ${file ? "text-fail" : "text-waiting"}`}>
          {file ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <>
              <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
              <path d="M21 3v5h-5" />
            </>
          )}
        </svg>
      </Seal>
      <div className="min-w-0">
        <h2 id="check-failed-heading" className="text-[15px] leading-snug font-bold">
          {banner.heading}
        </h2>
        {banner.body && <p className="mt-0.5 max-w-[72ch] text-[14px] text-ink-2 md:text-body">{banner.body}</p>}
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill bg-latte px-2.5 py-1 text-meta font-bold text-espresso-deep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {banner.hold}
        </p>
        {banner.showing && <p className="mt-2 text-meta text-ink-3">{banner.showing}</p>}
      </div>
    </section>
  );
}
