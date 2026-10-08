import Link from "next/link";
import type { SetupStep } from "@/lib/checklist-builder/step-links";

const STAGES: { id: SetupStep; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "brief", label: "Brief" },
  { id: "checklist", label: "Checklist" },
  { id: "invite", label: "Invite" },
];

// A 44px tap target that doesn't change the line's height.
const TAP = "-my-3 inline-block py-3 underline-offset-3 hover:underline";

/**
 * The header of a deal being set up: the crumb ("Deals › {brand}", each a
 * link), "{brand} · {title}" and the four steps (Posts, Brief, Checklist,
 * Invite), the current one marked and each step already reached a link back.
 *
 * @param brand - the brand's name (plain text); absent on the new deal page
 * @param dealId - the deal, for the brand's link in the crumb
 * @param title - the page's name after the brand, e.g. "Checklist", or the whole title without a brand
 * @param stage - the current step
 * @param links - where each reached step links to (stepLinks); the current step never links
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-22, docs/specs/creator-invite-frd.md
 */
export function DealStepHeader({
  brand,
  dealId,
  title,
  stage,
  links = {},
}: {
  brand?: string;
  dealId?: string;
  title: string;
  stage: SetupStep;
  links?: Partial<Record<SetupStep, string>>;
}) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <header>
      <p className="text-meta text-ink-3">
        <Link href="/deals" className={TAP}>
          Deals
        </Link>
        {" › "}
        {brand && dealId ? (
          <Link href={`/deals/${encodeURIComponent(dealId)}`} className={TAP}>
            {brand}
          </Link>
        ) : (
          <span>{brand ?? title}</span>
        )}
      </p>
      <h1 className="mt-1.5 font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">
        {brand ? `${brand} · ${title}` : title}
      </h1>
      <ol aria-label="New deal steps" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
        {STAGES.map((s, i) => {
          const href = i !== at ? links[s.id] : undefined;
          return (
            <li key={s.id} aria-current={i === at ? "step" : undefined} className={`flex items-center gap-2 ${i < at ? "text-espresso" : i === at ? "text-ink" : "text-ink-4"}`}>
              {i > 0 && <span aria-hidden="true" className="text-ink-4">·</span>}
              {href ? (
                <Link href={href} className={`${TAP} text-espresso underline`}>
                  {s.label}
                </Link>
              ) : (
                s.label
              )}
              {i < at && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>
    </header>
  );
}
