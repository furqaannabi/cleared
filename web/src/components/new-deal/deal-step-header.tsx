const STAGES = [
  { id: "posts", label: "Posts" },
  { id: "brief", label: "Brief" },
  { id: "checklist", label: "Checklist" },
  { id: "invite", label: "Invite" },
] as const;

/**
 * The header of a deal being set up: the crumb, "{brand} · {title}" and the
 * four steps (Posts, Brief, Checklist, Invite), with the current one marked.
 *
 * @param brand - the brand's name (plain text); absent on the new deal page
 * @param title - the page's name after the brand, e.g. "Checklist", or the whole title without a brand
 * @param stage - the current step
 * @see docs/specs/creator-brief-checklist-frd.md, docs/specs/creator-invite-frd.md
 */
export function DealStepHeader({ brand, title, stage }: { brand?: string; title: string; stage: (typeof STAGES)[number]["id"] }) {
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <header>
      <p className="text-meta text-ink-3">{`Deals › ${brand ?? title}`}</p>
      <h1 className="mt-1.5 font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">
        {brand ? `${brand} · ${title}` : title}
      </h1>
      <ol aria-label="New deal steps" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold">
        {STAGES.map((s, i) => (
          <li key={s.id} aria-current={i === at ? "step" : undefined} className={`flex items-center gap-2 ${i < at ? "text-espresso" : i === at ? "text-ink" : "text-ink-4"}`}>
            {i > 0 && <span aria-hidden="true" className="text-ink-4">·</span>}
            {s.label}
            {i < at && <span className="sr-only">(done)</span>}
          </li>
        ))}
      </ol>
    </header>
  );
}
