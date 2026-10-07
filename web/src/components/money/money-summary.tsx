"use client";

import { useState, type ReactNode } from "react";
import { Seal } from "@/components/ui/seal";
import { formatMoney } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { LockIcon, ReturnIcon } from "./money-icons";

const STAGE: Record<Deliverable["hold"]["stage"], string> = {
  held: "Held",
  confirmed: "Confirmed",
  captured: "Captured",
  paid: "Paid",
};

/**
 * Phones: the money as one row ("$1,200.00 held in PayPal · Ref … · Held")
 * that expands to the full money card, so the items needing the creator come
 * sooner. Still the page's "Payment for this deliverable" region.
 *
 * @param d - the deliverable, with its hold
 * @param children - the full money card, shown when expanded
 * @see DESIGN.md "Money card"; docs/specs/creator-draft-check-frd.md DC-FR-27, DC-FR-29
 */
export function MoneySummary({ d, children }: { d: Deliverable; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const amount = formatMoney(d.hold.amountMinor, d.hold.currency);
  const released = d.state === "released";
  return (
    <section aria-label="Payment for this deliverable">
      <div
        className={`flex items-center gap-3 rounded-md px-3.5 py-2.5 ${
          released ? "border border-latte-line bg-latte text-ink" : "bg-marigold text-marigold-ink shadow-money-card"
        }`}
      >
        <Seal fillClassName={released ? "fill-latte-line" : "fill-marigold-ink"} className="size-8">
          {released ? <ReturnIcon className="size-full text-espresso" /> : <LockIcon className="size-full text-marigold" />}
        </Seal>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-strong font-extrabold">
            {released ? `${amount} released` : `${amount} held in PayPal`}
          </p>
          <p className={`truncate text-label font-semibold ${released ? "text-ink-3" : "text-marigold-ink-2"}`}>
            {released ? `Went back to ${d.brandName}` : `Ref ${d.hold.reference} · ${STAGE[d.hold.stage]}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Payment details"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex min-h-11 items-center gap-1 rounded-pill px-3 text-chip font-bold ${
            released ? "text-espresso hover:bg-latte-line" : "text-marigold-ink hover:bg-marigold-chip"
          }`}
        >
          Details
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}
