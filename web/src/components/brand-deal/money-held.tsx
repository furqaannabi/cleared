"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

interface MoneyHeld {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the panel and moves focus to its heading (CH-FR-32). */
  show: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

const MoneyHeldContext = createContext<MoneyHeld | null>(null);

/** Shares the panel's open state between the terms (the panel) and the holds (the link to it). */
export function MoneyHeldProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const show = useCallback(() => {
    // Open first, so the heading's points are on the page when focus lands on it.
    flushSync(() => setOpen(true));
    headingRef.current?.focus();
  }, []);
  return <MoneyHeldContext.Provider value={{ open, setOpen, show, headingRef }}>{children}</MoneyHeldContext.Provider>;
}

function useMoneyHeld(): MoneyHeld {
  const v = useContext(MoneyHeldContext);
  if (!v) throw new Error("needs a MoneyHeldProvider");
  return v;
}

/**
 * "How your money is held": what a hold means for the brand, from the
 * product's rules, under How payment works. Folded on phones behind "Read",
 * open from `md:`. Never says how PayPal's own screens show a hold.
 *
 * @param creator - the creator's name
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-31
 */
export function MoneyHeldPanel({ creator }: { creator: string }) {
  const wide = useMediaQuery("(min-width: 768px)");
  const { open, setOpen, headingRef } = useMoneyHeld();
  const shown = wide || open;
  const points = [
    "PayPal reserves the amount for each post. Nothing is taken from your account yet.",
    `It’s taken only after ${creator}’s post is live and passes its check, and never more than you approved.`,
    `It comes back to you if ${creator} misses the deadline, if either of you cancels before ${creator} is told to publish, or on day 28 at the latest.`,
    `You pay the amounts above and nothing more. Cleared’s 5% fee comes out of ${creator}’s payout.`,
    "This is PayPal’s sandbox. No real money moves.",
  ];
  return (
    <section aria-label="How your money is held" className="mt-5 rounded-sm bg-latte-wash px-4 py-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-body-strong font-extrabold focus:outline-none">
        {wide ? (
          "How your money is held"
        ) : (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
            How your money is held · {open ? "Hide" : "Read"}
          </button>
        )}
      </h3>
      {shown && (
        <ul className="mt-1.5 grid list-disc gap-2 pl-5 text-[14px] text-ink-2 marker:text-ink-4">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Above the holds, after agreeing: "How your money is held", opening the
 * panel in the terms and moving focus to it.
 *
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-32
 */
export function MoneyHeldLink() {
  const { show } = useMoneyHeld();
  return (
    <button type="button" onClick={show} className="inline-flex min-h-11 items-center text-[14px] font-bold text-espresso underline underline-offset-3">
      How your money is held
    </button>
  );
}
