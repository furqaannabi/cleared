"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { legalPagesOn } from "@/lib/legal/flag";
import { api } from "@/lib/api";
import type { OpenDeal } from "@/lib/api/client";
import { FIELD, OUTLINE } from "./styles";

const WHY: Record<OpenDeal["why"], string> = { held: "a post is held", payout: "a payout is on its way", waiting_for_brand: "waiting on the brand" };

/**
 * Delete account, apart at the end: a typed confirmation in place, or the
 * API's refusal listing the open deals. On success the creator is signed out
 * and lands on the home page.
 *
 * @see docs/specs/settings-frd.md ST-FR-10, ST-FR-11
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState<OpenDeal[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();

  async function remove() {
    setBusy(true);
    setProblem(null);
    const r = await api.deleteAccount();
    setBusy(false);
    if (r.ok) return window.location.assign("/");
    if ("blocking" in r) {
      setOpen(false);
      return setBlocking(r.blocking);
    }
    setProblem(r.error === "signed_out" ? "You’ve been signed out. Sign in again to carry on." : "That didn’t go through. Try again.");
  }

  return (
    <section aria-labelledby={`${id}-h`} className="mt-7 rounded-[20px] border border-line bg-surface px-[18px] py-4 shadow-panel md:px-[26px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-[15px] font-bold">
            Delete account
          </h2>
          {!open && !blocking && <p className="text-[13.5px] text-ink-3">Removes your profile and your connected accounts.</p>}
          {/* ST-FR-10 (1.2): once the legal pages are linked (LG-FR-14). */}
          {legalPagesOn() && (
            <Link href="/data-deletion" className="inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3">
              How deleting works
            </Link>
          )}
        </div>
        {!open && (
          <button
            ref={opener}
            type="button"
            onClick={() => {
              setBlocking(null);
              setOpen(true);
            }}
            className="inline-flex min-h-11 items-center font-bold text-fail underline underline-offset-3"
          >
            Delete account
          </button>
        )}
      </div>
      {blocking && (
        <div role="alert" className="mt-1">
          <p className="text-[13.5px] font-bold text-fail">You can’t delete your account while a deal is open:</p>
          <ul className="my-2 ml-[18px] list-disc text-[14px] text-ink">
            {blocking.map((d) => (
              <li key={d.dealId}>
                {d.brandName}: {WHY[d.why]}
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-ink-3">Finish or cancel these first.</p>
        </div>
      )}
      {open && (
        <div className="mt-1">
          <p className="max-w-[60ch] text-[13.5px] text-ink-3">
            Your profile, your connected accounts and your drafts are deleted. Cleared keeps the payment records it must (amounts, dates and PayPal references), with your name and email removed.{" "}
            <b className="text-ink">This can’t be undone.</b>
          </p>
          <label htmlFor={id} className="mt-3 mb-1.5 block text-body-strong font-bold">
            Type delete to confirm
          </label>
          <input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={`${FIELD} max-w-80`} />
          {problem && <p className="mt-1.5 text-[13.5px] font-bold text-fail">{problem}</p>}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || typed.trim().toLowerCase() !== "delete"}
              onClick={() => void remove()}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-fail px-[18px] text-[14.5px] font-bold text-white disabled:opacity-50"
            >
              Delete my account
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                requestAnimationFrame(() => opener.current?.focus());
              }}
              className={OUTLINE}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
