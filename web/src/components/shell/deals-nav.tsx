"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemoBuild } from "@/components/mocking/demo-build";
import type { z } from "zod";
import type { dealsSchema } from "@/lib/api/schemas";

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
 * @see docs/specs/creator-draft-check-frd.md DC-FR-31; DESIGN.md "Navigation"
 */
export function DealsNav({
  deals,
  currentDealId,
  tone = "rail",
}: {
  deals: DealSummary[];
  currentDealId: string | null;
  tone?: "rail" | "sheet";
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
                className={`flex min-h-11 items-center gap-2.5 rounded-nav px-2.5 py-2 transition-colors ${
                  rail
                    ? `text-white/95 hover:bg-white/8 ${current ? "bg-white/14 text-white" : ""}`
                    : `text-ink hover:bg-latte-wash ${current ? "bg-latte" : ""}`
                }`}
              >
                <span aria-hidden="true" className={`grid size-7 flex-none place-items-center rounded-full text-label font-extrabold ${TINTS[i % TINTS.length]}`}>
                  {initials(deal.brandName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-body-strong font-semibold">{deal.brandName}</span>
                  <span className={`block truncate text-label font-medium ${rail ? (current ? "text-white/95" : "text-white/70") : "text-ink-3"}`}>
                    {deal.status}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <DemoReset rail={rail} />
    </nav>
  );
}

/** Mock builds only: back to the seeded demo data, after a confirm in place. */
function DemoReset({ rail }: { rail: boolean }) {
  const demo = useDemoBuild();
  const [asking, setAsking] = useState(false);
  if (!demo) return null;
  const quiet = `inline-flex min-h-11 items-center px-2.5 text-label font-semibold underline underline-offset-3 ${rail ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-ink"}`;
  return asking ? (
    <div className={`mt-3 grid gap-1 px-2.5 text-label ${rail ? "text-white/80" : "text-ink-2"}`}>
      <p>Every demo deal goes back to how it started.</p>
      <div className="flex gap-1">
        <button type="button" onClick={demo.reset} className={`${quiet} -mx-2.5 font-bold`}>
          Yes, reset
        </button>
        <button type="button" onClick={() => setAsking(false)} className={quiet}>
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button type="button" onClick={() => setAsking(true)} className={`${quiet} mt-3`}>
      Reset demo data
    </button>
  );
}
