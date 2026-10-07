import { StatusSeal } from "@/components/checklist/status-seal";
import { Seal } from "@/components/ui/seal";
import type { DeliverableView } from "@/lib/deliverable/deliverable-view";

/**
 * The fully passing moment: "proof earns the seal". A large pass seal stamps
 * once, and one small seal per checked item lines up beside the words. Calm
 * and certain, not a celebration; still under reduced motion. What happens
 * next (the brand's review window) stays in the next-step bar.
 *
 * @param passed - how many draft-check items passed, and their statuses
 * @param brandName - the deal's brand
 * @see DESIGN.md "Creative North Star"; docs/specs/creator-draft-check-frd.md DC-FR-07
 */
export function PassedBanner({ passed, brandName }: { passed: NonNullable<DeliverableView["passed"]>; brandName: string }) {
  return (
    <section
      aria-labelledby="passed-heading"
      className="mt-5 flex items-center gap-4 rounded-lg border border-pass-wash bg-surface px-4 py-4 md:gap-5 md:px-5"
    >
      <Seal fillClassName="fill-pass-wash" className="size-12 motion-safe:animate-seal-stamp md:size-14">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-pass">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Seal>
      <div className="min-w-0">
        <h2 id="passed-heading" className="text-item-title font-bold">
          Every item passed
        </h2>
        <p className="mt-0.5 text-[14px] text-ink-2 md:text-body">
          {passed.count} {passed.count === 1 ? "item" : "items"} checked against {brandName}’s brief. Nothing left to fix.
        </p>
        <ul aria-hidden="true" className="mt-2.5 flex flex-wrap gap-1">
          {passed.statuses.map((status, i) => (
            <li key={i} data-testid="item-seal" className="motion-safe:animate-seal-in" style={{ animationDelay: `${180 + i * 45}ms` }}>
              <StatusSeal status={status} className="size-5" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
