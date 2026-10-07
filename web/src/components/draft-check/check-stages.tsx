import { StatusSeal } from "@/components/checklist/status-seal";
import { Seal } from "@/components/ui/seal";
import type { DeliverableView } from "@/lib/deliverable/deliverable-view";

const WORD = { done: "Done", current: "Now", waiting: "Next" } as const;

/**
 * While a draft is being checked, its stages in plain words, each done, now
 * or next, with how far along it is. Takes the evidence panel's place.
 *
 * @param checking - the stages and progress line from the deliverable view
 * @see docs/specs/creator-draft-check-frd.md DC-FR-04; DESIGN.md "Check stages panel"
 */
export function CheckStages({ checking }: { checking: NonNullable<DeliverableView["checking"]> }) {
  return (
    <section aria-labelledby="check-stages-heading" className="rounded-lg border border-line bg-surface px-[18px] py-4 shadow-panel md:px-[22px] md:py-5">
      <h2 id="check-stages-heading" className="text-item-title font-bold">
        Checking your draft
      </h2>
      <p className="mt-0.5 text-meta text-ink-3">{checking.meta}</p>
      <ol className="mt-4 grid gap-1" aria-live="polite">
        {checking.stages.map((stage) => (
          <li
            key={stage.name}
            aria-current={stage.status === "current" ? "step" : undefined}
            className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2 text-body-strong ${
              stage.status === "done" ? "font-semibold text-ink-2" : stage.status === "current" ? "font-bold text-ink" : "font-semibold text-ink-4"
            }`}
          >
            {stage.status === "done" ? (
              <Seal fillClassName="fill-latte" className="size-[26px]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </Seal>
            ) : (
              <StatusSeal status={stage.status === "current" ? "checking" : "not_checked"} className="size-[26px]" />
            )}
            <span>{stage.name}</span>
            <small className="text-chip font-semibold text-ink-3">{WORD[stage.status]}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
