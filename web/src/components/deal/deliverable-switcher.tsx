import Link from "next/link";
import { stepLabel } from "@/lib/deliverable/deal-steps";
import type { Deliverable } from "@/lib/deliverable/types";

const NAME: Record<Deliverable["platform"], string> = {
  youtube_video: "YouTube video",
  youtube_short: "YouTube Short",
  instagram_reel: "Instagram Reel",
};

/**
 * Pills under the title, one per deliverable in the deal: a frame icon
 * (landscape for a video, portrait for a Short or Reel), its name and its
 * step. Each links to that deliverable; the current one fills espresso. Not
 * shown for a deal with one deliverable. Scrolls sideways on phones.
 *
 * @param dealId - the deal
 * @param deliverables - the deal's deliverables
 * @param currentId - the deliverable being viewed
 * @see docs/specs/creator-draft-check-frd.md DC-FR-33; DESIGN.md "Deliverable switcher"
 */
export function DeliverableSwitcher({
  dealId,
  deliverables,
  currentId,
}: {
  dealId: string;
  deliverables: { id: string; platform: Deliverable["platform"]; state: Deliverable["state"] }[];
  currentId: string;
}) {
  if (deliverables.length < 2) return null;
  return (
    <nav aria-label="Deliverables in this deal" className="mt-3.5 max-w-full overflow-hidden rounded-md border border-line bg-surface md:w-max md:rounded-pill">
      <ul className="flex gap-1.5 overflow-x-auto p-1 [scrollbar-width:none]">
        {deliverables.map((d) => {
          const current = d.id === currentId;
          return (
            <li key={d.id} className="flex-none">
              <Link
                href={`/deals/${encodeURIComponent(dealId)}/deliverables/${encodeURIComponent(d.id)}`}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-pill py-1.5 pr-4 pl-2.5 transition-colors ${
                  current ? "bg-espresso text-surface" : "text-ink hover:bg-latte-wash"
                }`}
              >
                <FrameIcon portrait={d.platform !== "youtube_video"} className={current ? "text-white/80" : "text-ink-3"} />
                <span>
                  <b className="block text-tab leading-tight font-bold whitespace-nowrap">{NAME[d.platform]}</b>
                  <span className={`block text-label leading-tight font-semibold whitespace-nowrap ${current ? "text-white/80" : "text-ink-3"}`}>
                    {stepLabel(d.state)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FrameIcon({ portrait, className }: { portrait: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-5 flex-none ${className}`}>
      {portrait ? <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /> : <rect x="2.5" y="5" width="19" height="14" rx="3" />}
      <path d={portrait ? "m10.5 9.5 3.5 2.5-3.5 2.5z" : "m10 9.5 4.5 2.5-4.5 2.5z"} />
    </svg>
  );
}
