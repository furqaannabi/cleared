import { Seal } from "@/components/ui/seal";
import type { DeliverableView } from "@/lib/deliverable/deliverable-view";

/**
 * The top of a deliverable's page: breadcrumb, title, details line and the
 * seven deal steps (a dot track on phones). Crumbs are plain text until the
 * deals list and deal routes exist.
 *
 * @param view - the deliverable view (title, meta, steps)
 * @param brandName - the deal's brand, for the breadcrumb
 * @param deliverableName - "YouTube video", for the breadcrumb
 * @see docs/specs/creator-draft-check-frd.md DC-FR-32, DC-FR-34; DESIGN.md "Layout"
 */
export function DealHeader({
  view,
  brandName,
  deliverableName,
}: {
  view: DeliverableView;
  brandName: string;
  deliverableName: string;
}) {
  const { steps } = view;
  return (
    <header>
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-1.5 text-meta text-ink-3">
          {["Deals", brandName].map((crumb) => (
            <li key={crumb} className="flex items-center gap-1.5 after:text-ink-4 after:content-['›']">
              {crumb}
            </li>
          ))}
          <li aria-current="page" className="text-ink-2">
            {deliverableName}
          </li>
        </ol>
      </nav>
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:mt-2.5 md:text-page-title">{view.title}</h1>
      <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[14.5px] text-ink-3">
        {view.meta.map((part, i) => (
          <span key={part} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="text-ink-4">·</span>}
            {part}
          </span>
        ))}
      </p>

      {/* Phones: a compact dot track. */}
      <div className="mt-3.5 flex items-center gap-2.5 text-[13.5px] font-bold text-ink-2 md:hidden">
        <span aria-hidden="true" className="flex gap-1">
          {steps.items.map((s) => (
            <i
              key={s.label}
              className={`h-1.5 w-[18px] rounded-pill ${s.state === "done" ? "bg-espresso" : s.state === "current" ? "bg-marigold" : "bg-line"}`}
            />
          ))}
        </span>
        {steps.summary}
      </div>

      {/* Tablet and up: every step named, with connector bars. */}
      <ol aria-label="Deal progress" className="mt-5 hidden items-center md:flex">
        {steps.items.map((s, i) => (
          <li
            key={s.label}
            aria-current={s.state === "current" ? "step" : undefined}
            className={`flex flex-1 items-center gap-2 whitespace-nowrap text-meta font-bold last:flex-none ${
              s.state === "done" ? "text-espresso" : s.state === "current" ? "text-ink" : "text-ink-4"
            }`}
          >
            {s.state === "done" && <StepSeal tone="done" />}
            {s.state === "current" && <StepSeal tone="current" />}
            {s.label}
            {i < steps.items.length - 1 && (
              <span aria-hidden="true" className={`mx-2.5 h-0.5 min-w-4 flex-1 rounded-bar ${s.state === "done" ? "bg-espresso" : "bg-line"}`} />
            )}
          </li>
        ))}
      </ol>
    </header>
  );
}

function StepSeal({ tone }: { tone: "done" | "current" }) {
  return tone === "done" ? (
    <Seal fillClassName="fill-latte" className="size-[22px]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </Seal>
  ) : (
    // DESIGN.md: marigold marks the current deal step.
    <Seal fillClassName="fill-marigold" className="size-[22px]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full text-espresso-ink">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </Seal>
  );
}
