"use client";

import { useId, useState } from "react";
import { Seal } from "@/components/ui/seal";
import type { Deliverable } from "@/lib/deliverable/types";
import type { Journey, JourneyStep } from "@/lib/publish/journey";
import type { JourneyActions } from "./use-journey-actions";

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-espresso px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover disabled:opacity-50";
const OUTLINE = "inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso disabled:opacity-50";
const FIELD = "block w-full rounded-sm border border-latte-line bg-surface px-3 py-2.5 text-[16px] focus-visible:border-espresso";

/**
 * "From approved to paid" (design B): the amount, then each step from the
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
    <section id="journey" aria-label="From approved to paid" className="grid scroll-mt-4 rounded-[20px] border border-line bg-surface p-[18px]">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <span className="text-[13.5px] text-ink-2">{view.heading}</span>
        <b className="font-head text-[30px] font-extrabold tracking-[-0.01em] tabular-nums">{view.amount}</b>
      </div>
      <ol className="grid">
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

const SEAL: Record<JourneyStep["state"], { fill: string; icon: React.ReactNode }> = {
  done: { fill: "fill-latte", icon: <path d="M20 6 9 17l-5-5" /> },
  now: { fill: "fill-marigold", icon: <circle cx="12" cy="12" r="2.5" fill="currentColor" /> },
  todo: { fill: "fill-line-soft", icon: null },
  problem: { fill: "fill-fail-wash", icon: <path d="M6 21V4M6 4h11l-2 4 2 4H6" /> },
};

function Step({ step, last, children }: { step: JourneyStep; last: boolean; children?: React.ReactNode }) {
  const open = step.state === "now" || step.state === "problem";
  return (
    <li
      aria-current={open ? "step" : undefined}
      className={`relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-3 ${open ? `-mx-2.5 my-1 rounded-[14px] px-2.5 ${step.state === "problem" ? "bg-fail-tint" : "bg-latte-wash"}` : ""}`}
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

/** The current step's action, opened in place where it needs more (posting, a corrected email). */
function Act({ d, view, actions }: { d: Deliverable; view: Journey; actions: JourneyActions }) {
  const a = view.action;
  const id = useId();
  const [link, setLink] = useState("");
  const [email, setEmail] = useState(d.payout?.email ?? d.payoutEmail);
  if (!a) return null;
  const problem = actions.problem && (
    <p role="alert" className="text-meta font-bold text-fail">
      {actions.problem}
    </p>
  );

  if (a.kind === "posted" && actions.posting) {
    if (d.platform === "instagram_reel")
      return (
        <div className="grid gap-2">
          <label htmlFor={id} className="text-[13.5px] font-bold text-ink">
            Your Reel’s link
          </label>
          <input id={id} type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/reel/…" className={FIELD} />
          {problem}
          <span className="flex flex-wrap gap-2">
            <button type="button" disabled={actions.busy} onClick={() => actions.postedReel(link)} className={PRIMARY}>
              Check my Reel
            </button>
            <button type="button" onClick={actions.closePosting} className={OUTLINE}>
              Not yet
            </button>
          </span>
        </div>
      );
    return (
      <div className="grid gap-2 rounded-[14px] border border-latte-line bg-surface p-3">
        <p className="text-[14px] text-ink">
          <b>Is the video public on your channel?</b> We check it’s the same video you uploaded as unlisted.
        </p>
        {problem}
        <span className="flex flex-wrap gap-2">
          <button type="button" disabled={actions.busy} onClick={actions.postedYouTube} className={PRIMARY}>
            Yes, it’s public
          </button>
          <button type="button" onClick={actions.closePosting} className={OUTLINE}>
            Not yet
          </button>
        </span>
      </div>
    );
  }

  const run = () => {
    if (a.kind === "get_go_ahead") return actions.getGoAhead();
    if (a.kind === "posted") return actions.openPosting();
    if (a.kind === "check_again") return actions.checkAgain();
    return actions.sendAgain(a.fixEmail ? email : undefined);
  };
  return (
    <div className="grid gap-2">
      {a.fixEmail && (
        <>
          <label htmlFor={id} className="text-[13.5px] font-bold text-ink">
            Your PayPal email
          </label>
          <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        </>
      )}
      {problem}
      <button type="button" disabled={a.disabled || actions.busy} onClick={run} className={`${a.kind === "send_again" && !a.fixEmail ? OUTLINE : PRIMARY} justify-self-start`}>
        {a.label}
      </button>
    </div>
  );
}
