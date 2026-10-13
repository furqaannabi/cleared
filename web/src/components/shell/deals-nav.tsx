"use client";

import Link from "next/link";
import type { z } from "zod";
import type { dealsSchema } from "@/lib/api/schemas";
import { RailTip } from "./rail-tip";

type DealSummary = z.infer<typeof dealsSchema>[number];

// DESIGN.md: avatar tints identify a deal and carry no status.
const TINTS = ["bg-avatar-rose text-avatar-rose-ink", "bg-avatar-sky text-avatar-sky-ink", "bg-avatar-sun text-avatar-sun-ink"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The creator's deals: initials avatar, brand and one-line status, each a
 * link to the deal; the current deal is marked. Used in the espresso rail
 * and in the phone "Deals" sheet.
 *
 * @param deals - the creator's deals
 * @param currentDealId - the deal being viewed
 * @param tone - "rail" for the espresso rail, "sheet" for the light sheet
 * @param slim - the folded rail: the avatar alone, the brand as its name and tooltip, no status (DC-FR-55)
 * @param needsYou - the deals that need the creator: a dot on the avatar, "Needs you" for screen readers, and the status in bold (1.26)
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31, DC-FR-55; DESIGN.md "Navigation"
 */
export function DealsNav({
  deals,
  currentDealId,
  tone = "rail",
  slim = false,
  needsYou = new Set(),
}: {
  deals: DealSummary[];
  currentDealId: string | null;
  tone?: "rail" | "sheet";
  slim?: boolean;
  needsYou?: ReadonlySet<string>;
}) {
  const rail = tone === "rail";
  return (
    <nav aria-label="Deals">
      <ul className="flex flex-col gap-0.5">
        {deals.map((deal, i) => {
          const current = deal.id === currentDealId;
          const needs = needsYou.has(deal.id);
          return (
            <li key={deal.id}>
              <Link
                href={`/deals/${encodeURIComponent(deal.id)}`}
                aria-current={current ? "page" : undefined}
                className={`group relative flex min-h-11 items-center gap-2.5 rounded-nav py-2 transition-colors ${slim ? "justify-center px-0" : "px-2.5"} ${
                  rail
                    ? `text-white/95 hover:bg-white/8 ${current ? "bg-white/14 text-white" : ""}`
                    : `text-ink hover:bg-latte-wash ${current ? "bg-latte" : ""}`
                }`}
              >
                <span aria-hidden="true" className={`relative grid size-7 flex-none place-items-center rounded-full text-label font-extrabold ${TINTS[i % TINTS.length]}`}>
                  {initials(deal.brandName)}
                  {needs && <NeedsYouDot tone={tone} />}
                </span>
                {needs && <span className="sr-only">Needs you</span>}
                {slim ? (
                  <>
                    <span className="sr-only">{deal.brandName}</span>
                    <RailTip>{deal.brandName}</RailTip>
                  </>
                ) : (
                  <span className="min-w-0">
                    <span className="block truncate text-body-strong font-semibold">{deal.brandName}</span>
                    <span
                      className={`block truncate text-label ${needs ? `font-bold ${rail ? "text-white" : "text-ink"}` : `font-medium ${rail ? (current ? "text-white/95" : "text-white/70") : "text-ink-3"}`}`}
                    >
                      {deal.status}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The "needs you" dot on a deal's avatar or the Deals button: marigold on the
 * espresso rail, espresso on the light sheet (marigold is too faint there),
 * ringed in the ground it sits on. Decorative; the words are beside it.
 *
 * @param tone - "rail" or "sheet"
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31 (1.26); DESIGN.md "Navigation"
 */
export function NeedsYouDot({ tone, className = "-top-[3px] -right-[3px]" }: { tone: "rail" | "sheet"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute size-[11px] rounded-full border-2 ${tone === "rail" ? "border-espresso-deep bg-marigold" : "border-surface bg-espresso"} ${className}`}
    />
  );
}
