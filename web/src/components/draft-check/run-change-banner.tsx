import { Seal } from "@/components/ui/seal";
import type { RunChange } from "@/lib/deliverable/run-change";

/**
 * What the latest run changed, between the header and the results (DC-FR-48):
 * what got fixed, what got worse, acceptances the new draft cancelled, what
 * still needs the creator, and which run is shown. A pass seal when something
 * was fixed and nothing got worse; a neutral one otherwise. The seal stamps
 * in once, only when the run landed while the creator was on the page.
 *
 * @param change - the summary from the deliverable view
 * @param landed - the run arrived while the page was open (Checking turned into results)
 * @see docs/specs/creator-draft-check-frd.md DC-FR-48; DESIGN.md "Run change banner"
 */
export function RunChangeBanner({ change, landed }: { change: RunChange; landed: boolean }) {
  const pass = change.tone === "pass";
  return (
    <section
      aria-labelledby="run-change-heading"
      data-tone={change.tone}
      className={`mt-5 grid grid-cols-[32px_1fr] items-start gap-3 rounded-lg border bg-surface px-4 py-3.5 md:grid-cols-[40px_1fr] md:gap-3.5 md:px-5 md:py-4 ${
        pass ? "border-pass-wash" : "border-line"
      }`}
    >
      <span data-testid="run-change-seal" data-stamp={landed || undefined} className={landed ? "motion-safe:animate-seal-stamp" : undefined}>
        <Seal fillClassName={pass ? "fill-pass-wash" : "fill-latte"} className="size-8 md:size-10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-full ${pass ? "text-pass" : "text-espresso"}`}>
            {pass ? (
              <path d="M20 6 9 17l-5-5" />
            ) : (
              <>
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
              </>
            )}
          </svg>
        </Seal>
      </span>
      <div className="min-w-0">
        <h2 id="run-change-heading" className="text-[15px] leading-snug font-bold">
          {change.heading}
        </h2>
        <div className="mt-0.5 max-w-[72ch] text-[14px] text-ink-2 md:text-body">
          {change.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {change.stillNeedsYou && <p className="mt-1 font-semibold text-ink">{change.stillNeedsYou}</p>}
        </div>
        <p className="mt-2 text-meta text-ink-3">{change.showing}</p>
      </div>
    </section>
  );
}
