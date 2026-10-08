"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useOptionalSession } from "./use-session";

/**
 * The creator's name at the foot of the rail (and the phone deals sheet): a
 * button that opens a small menu with the signed-in email and "Sign out", or,
 * in the demo account, "Demo account · made-up data" and "Leave the demo".
 * Either signs out and opens the landing. Escape or a tap outside closes it
 * and returns focus to the name.
 *
 * @param tone - "rail" on espresso, "sheet" on the light deals sheet
 * @see docs/specs/sign-in-frd.md SI-FR-11 to SI-FR-13; design/sign-in/shared.html
 */
export function AccountMenu({ tone }: { tone: "rail" | "sheet" }) {
  const session = useOptionalSession();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (session?.load.status !== "signed_in") return null;
  const me = session.load.me;
  const demo = !!me.demo;
  const initials = me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const signOut = async () => {
    await api.signOut();
    window.location.assign("/");
  };
  const rail = tone === "rail";
  return (
    <div
      ref={box}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      {open && (
        <div id={id} className="absolute right-0 bottom-full left-0 mb-2 grid rounded-[14px] bg-surface p-1.5 text-ink shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
          <span className="border-b border-line-soft px-3 pt-2.5 pb-2 text-[13px] text-ink-3">{demo ? "Demo account · made-up data" : me.email}</span>
          <button type="button" onClick={() => void signOut()} className="flex min-h-11 items-center rounded-[10px] px-3 text-left font-bold text-espresso hover:bg-latte-wash">
            {demo ? "Leave the demo" : "Sign out"}
          </button>
        </div>
      )}
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`grid min-h-11 w-full grid-cols-[30px_minmax(0,1fr)_16px] items-center gap-x-2.5 rounded-[12px] p-2 text-left ${rail ? "bg-white/[0.08] text-white hover:bg-white/[0.14]" : "border border-line bg-surface text-ink"}`}
      >
        <span aria-hidden="true" className="row-span-2 grid size-[30px] place-items-center rounded-full bg-marigold text-[12px] font-extrabold text-espresso-ink">
          {initials}
        </span>
        <b className="col-start-2 truncate text-[14.5px]">{me.name}</b>
        <span className={`col-start-2 truncate text-[12.5px] ${rail ? "text-white/70" : "text-ink-3"}`}>{demo ? "Demo account" : "Creator"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true" className={`col-start-3 row-span-2 row-start-1 size-4 transition-transform ${open ? "" : "rotate-180"}`}>
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}
