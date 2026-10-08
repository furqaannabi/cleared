"use client";

import type { ApprovalProps } from "@/components/brand-deal/paypal-approval";
import { formatAmount } from "@/lib/invite/amount";
import { setDemoOutcome } from "@/mocks/demo-paypal";
import type { HoldOutcome } from "@/mocks/brand-deals";

const ANSWERS: { label: string; outcome: HoldOutcome }[] = [
  { label: "Approve", outcome: "held" },
  { label: "Approve, but the card is declined", outcome: "declined" },
  { label: "Approve, but PayPal is slow", outcome: "pending" },
  { label: "Approve, but PayPal doesn’t answer", outcome: "unknown" },
];

const BUTTON = "inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-4 text-[13.5px] font-bold text-espresso";

/**
 * Mock builds only: a stand-in for PayPal's approval step, so every hold
 * state can be shown without PayPal. Loaded with the mocks, never in a
 * production build. Nothing here reaches PayPal.
 *
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-17, "Mocks"
 */
export function DemoPayPal({ label, amount, onApproved, onClosed }: ApprovalProps) {
  return (
    <div role="dialog" aria-label="Demo PayPal" className="mt-2 grid gap-2 rounded-md border border-dashed border-latte-line bg-latte-wash p-3">
      <p className="text-meta text-ink-2">
        <b className="text-ink">Demo PayPal</b> (mocks only): approve a {formatAmount(amount)} hold for the {label}?
      </p>
      <div className="flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.outcome}
            type="button"
            className={BUTTON}
            onClick={async () => {
              await setDemoOutcome(a.outcome);
              onApproved();
            }}
          >
            {a.label}
          </button>
        ))}
        <button type="button" className={BUTTON} onClick={onClosed}>
          Close PayPal
        </button>
      </div>
    </div>
  );
}
