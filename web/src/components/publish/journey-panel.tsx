"use client";

import { LockIcon } from "@/components/money/money-icons";
import { Seal } from "@/components/ui/seal";
import type { Deliverable } from "@/lib/deliverable/types";
import type { Journey, JourneyStep } from "@/lib/publish/journey";
import { Act } from "./journey-act";
import type { JourneyActions } from "./use-journey-actions";


/**
 * "From approved to paid" (design B): the money header (the money card
 * carried through to Paid), then each step from the
 * approved draft to the payout, done, current or still to come, the current
 * one with its words, countdown and action. Every figure is the API's.
 *
 * @param d - the deliverable
 * @param view - its journey
 * @param actions - the creator's actions
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01 to PP-FR-23; DESIGN.md "Publish and pay (the journey)"
 */
export function JourneyPanel({ d, view, actions }: { d: Deliverable; view: Journey; actions: JourneyActions }) {
  return (
    <section
      id="journey"
      aria-label="From approved to paid"
      className={`grid scroll-mt-4 overflow-hidden rounded-[20px] border border-line bg-surface ${view.tone === "money" ? "shadow-money-card" : ""}`}
    >
      <MoneyHeader view={view} />
      <ol className="grid px-[18px] pt-1.5 pb-3.5">
        {view.steps.map((step, i) => (
          <Step key={step.key} step={step} last={i === view.steps.length - 1}>
            {(step.state === "now" || step.state === "problem") && <Act key={d.payout?.email ?? d.payoutEmail} d={d} view={view} actions={actions} />}
          </Step>
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {(() => {
          const current = view.steps.find((s) => s.state === "now" || s.state === "problem");
          return current ? `Now: ${current.title}` : "";
        })()}
      </p>
    </section>
  );
}

const HEADER: Record<Journey["tone"], { box: string; ink: string; circle: string; seal: string; icon: string }> = {
  money: { box: "bg-marigold text-marigold-ink", ink: "text-marigold-ink-2", circle: "bg-white/25", seal: "fill-marigold-ink", icon: "text-marigold" },
  cleared: { box: "border-b border-line bg-surface text-ink", ink: "text-ink-3", circle: "bg-latte", seal: "fill-marigold", icon: "text-espresso" },
  stopped: { box: "border-b border-latte-line bg-latte text-ink", ink: "text-ink-3", circle: "bg-white/40", seal: "fill-latte-line", icon: "text-espresso" },
};

// DESIGN.md "Money card", carried through to Paid: marigold while the money moves towards the creator, white with the Cleared seal once paid.
function MoneyHeader({ view }: { view: Journey }) {
  const t = HEADER[view.tone];
  return (
    <div className={`relative isolate overflow-hidden pt-[18px] pr-[84px] pb-4 pl-[18px] ${t.box}`}>
      <span aria-hidden="true" className={`absolute -top-[46px] -right-[46px] -z-10 size-[150px] rounded-full ${t.circle}`} />
      <Seal fillClassName={t.seal} className="absolute top-4 right-[18px] size-[44px]">
        {view.tone === "cleared" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-full ${t.icon}`}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <LockIcon className={`size-full ${t.icon}`} />
        )}
      </Seal>
      <p className={`text-chip font-bold ${t.ink}`}>{view.heading}</p>
      <p className="mt-1 font-head text-amount-phone font-extrabold tracking-[-0.01em] tabular-nums">{view.amount}</p>
      <p className={`mt-1 text-chip font-semibold ${t.ink}`}>{view.reference}</p>
    </div>
  );
}

const SEAL: Record<JourneyStep["state"], { fill: string; icon: React.ReactNode }> = {
  done: { fill: "fill-latte", icon: <path d="M20 6 9 17l-5-5" /> },
  now: { fill: "fill-marigold", icon: <circle cx="12" cy="12" r="2.5" fill="currentColor" /> },
  todo: { fill: "fill-line-soft", icon: null },
  problem: { fill: "fill-fail-wash", icon: <path d="M6 21V4M6 4h11l-2 4 2 4H6" /> },
};

// A PayPal email has no spaces; `wrap-anywhere` breaks it rather than letting it run out of the step (PP-FR-17).
function Step({ step, last, children }: { step: JourneyStep; last: boolean; children?: React.ReactNode }) {
  const open = step.state === "now" || step.state === "problem";
  return (
    <li
      aria-current={open ? "step" : undefined}
      className={`relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 wrap-anywhere gap-y-0.5 py-3 ${open ? `-mx-2.5 my-1 rounded-[14px] px-2.5 ${step.state === "problem" ? "bg-fail-tint" : "bg-latte-wash"}` : ""}`}
    >
      {!last && !open && <span aria-hidden="true" className={`absolute top-[34px] -bottom-3 left-[11px] w-0.5 ${step.state === "done" ? "bg-latte-line" : "bg-line"}`} />}
      <Seal fillClassName={SEAL[step.state].fill} className={`z-[1] size-6 ${step.state === "problem" ? "text-fail" : "text-espresso"}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full">
          {SEAL[step.state].icon}
        </svg>
      </Seal>
      <b className={`text-[15px] ${step.state === "todo" ? "text-ink-3" : "text-ink"}`}>{step.title}</b>
      {(step.meta || step.link) && (
        <p className="col-start-2 text-[13px] text-ink-3">
          {step.meta}
          {step.meta && step.link && " · "}
          {step.link && (
            <a href={step.link.href} target="_blank" rel="noopener noreferrer" className="font-bold text-espresso underline underline-offset-3">
              {step.link.label}
            </a>
          )}
        </p>
      )}
      {open && (
        <div className="col-start-2 mt-1 grid gap-2 text-[14px] text-ink-2">
          {step.countdown && (
            <p>
              <span className="font-head text-[26px] font-extrabold text-ink tabular-nums">{step.countdown.text}</span> left
            </p>
          )}
          {step.body && <p>{step.body}</p>}
          {children}
        </div>
      )}
    </li>
  );
}
