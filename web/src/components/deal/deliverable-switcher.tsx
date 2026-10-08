"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
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
 * step. Each links to that deliverable; the current one sits on an espresso
 * pill that glides from the last tab shown in this deal (still under reduced
 * motion). Not shown for a deal with one deliverable. Scrolls sideways on phones.
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
  const { list, pill } = useGlide(dealId, currentId);
  if (deliverables.length < 2) return null;
  return (
    <nav aria-label="Deliverables in this deal" className="mt-3.5 max-w-full overflow-hidden rounded-md border border-line bg-surface md:w-max md:rounded-pill">
      <ul ref={list} className="group relative isolate flex gap-1.5 overflow-x-auto p-1 [scrollbar-width:none]">
        <span ref={pill} data-tab-pill aria-hidden="true" className="absolute top-1 bottom-1 -z-10 rounded-pill bg-espresso" />
        {deliverables.map((d) => {
          const current = d.id === currentId;
          return (
            <li key={d.id} className="flex-none">
              <Link
                href={`/deals/${encodeURIComponent(dealId)}/deliverables/${encodeURIComponent(d.id)}`}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-pill py-1.5 pr-4 pl-2.5 transition-colors duration-150 ${
                  // The current tab reads white once the pill is under it.
                  current ? "text-surface group-data-gliding:text-ink" : "text-ink hover:bg-latte-wash"
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

type Box = { left: number; width: number };
const GLIDE_MS = 220;
/** Per deal: where the pill last settled, and a glide in progress (the page is rebuilt mid-glide when the post arrives). */
const settled = new Map<string, Box>();
const glides = new Map<string, { from: Box; to: string; startedAt: number }>();

/**
 * Puts the pill under the current tab, gliding from where it was last shown
 * in this deal; the list carries `data-gliding` while it moves.
 */
function useGlide(dealId: string, currentId: string) {
  const list = useRef<HTMLUListElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const ul = list.current;
    const tab = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    const el = pill.current;
    if (!ul || !tab || !el) return;
    const to = { left: tab.offsetLeft, width: tab.offsetWidth };
    el.style.left = `${to.left}px`;
    el.style.width = `${to.width}px`;
    const now = performance.now();
    const running = glides.get(dealId);
    const last = settled.get(dealId);
    settled.set(dealId, to);
    let from: Box | undefined;
    let elapsed = 0;
    if (running && running.to === currentId && now - running.startedAt < GLIDE_MS) {
      from = running.from;
      elapsed = now - running.startedAt;
    } else if (last && (last.left !== to.left || last.width !== to.width)) {
      from = last;
      glides.set(dealId, { from, to: currentId, startedAt: now });
    }
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!from || still || typeof el.animate !== "function") return;
    const glide = el.animate(
      [
        { left: `${from.left}px`, width: `${from.width}px` },
        { left: `${to.left}px`, width: `${to.width}px` },
      ],
      { duration: GLIDE_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
    glide.currentTime = elapsed;
    ul.dataset.gliding = "";
    const done = () => delete ul.dataset.gliding;
    glide.finished.then(done, done);
    return () => glide.cancel();
  }, [dealId, currentId]);
  return { list, pill };
}

function FrameIcon({ portrait, className }: { portrait: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-5 flex-none ${className}`}>
      {portrait ? <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /> : <rect x="2.5" y="5" width="19" height="14" rx="3" />}
      <path d={portrait ? "m10.5 9.5 3.5 2.5-3.5 2.5z" : "m10 9.5 4.5 2.5-4.5 2.5z"} />
    </svg>
  );
}
