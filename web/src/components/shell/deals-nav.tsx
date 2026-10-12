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
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31, DC-FR-55; DESIGN.md "Navigation"
 */
export function DealsNav({
  deals,
  currentDealId,
  tone = "rail",
  slim = false,
}: {
  deals: DealSummary[];
  currentDealId: string | null;
  tone?: "rail" | "sheet";
  slim?: boolean;
}) {
  const rail = tone === "rail";
  return (
    <nav aria-label="Deals">
      <ul className="flex flex-col gap-0.5">
        {deals.map((deal, i) => {
          const current = deal.id === currentDealId;
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
                <span aria-hidden="true" className={`grid size-7 flex-none place-items-center rounded-full text-label font-extrabold ${TINTS[i % TINTS.length]}`}>
                  {initials(deal.brandName)}
                </span>
                {slim ? (
                  <>
                    <span className="sr-only">{deal.brandName}</span>
                    <RailTip>{deal.brandName}</RailTip>
                  </>
                ) : (
                  <span className="min-w-0">
                    <span className="block truncate text-body-strong font-semibold">{deal.brandName}</span>
                    <span className={`block truncate text-label font-medium ${rail ? (current ? "text-white/95" : "text-white/70") : "text-ink-3"}`}>
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
