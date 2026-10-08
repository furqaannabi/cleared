"use client";

import { useState } from "react";
import { EmailField } from "@/components/invite/email-field";
import { api } from "@/lib/api";
import type { CreatorProfile } from "@/lib/invite/types";

const CONNECT = "inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso hover:bg-latte-wash";
const ACCOUNTS = [
  { platform: "youtube", name: "YouTube", what: "Read-only. For your videos and Shorts.", mark: "bg-[#FFE9E7] text-[#C4302B]" },
  { platform: "instagram", name: "Instagram", what: "Professional accounts only. For your Reels.", mark: "bg-[#FCE3EC] text-[#9C2A55]" },
] as const;

/**
 * "Set up in a minute": connect YouTube, connect Instagram and the PayPal
 * email, each optional and saved as it's done, with how many are done.
 * Connecting follows IN-FR-10 and IN-FR-11; the email is IN-FR-12's.
 *
 * @param me - the creator's profile
 * @param onMe - takes the profile a save returned
 * @see docs/specs/sign-in-frd.md SI-FR-09; design/sign-in/option-c.html
 */
export function SetupCard({ me, onMe }: { me: CreatorProfile; onMe: (me: CreatorProfile) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const connected = (p: string) => me.accounts.find((a) => a.platform === p);
  const done = ACCOUNTS.filter((a) => connected(a.platform)).length + (me.paypalEmail ? 1 : 0);
  const take = async (call: () => ReturnType<typeof api.getProfile>) => {
    setProblem(null);
    const r = await call();
    if (r.ok) onMe(r.data);
    else setProblem("That didn’t save. Try again.");
  };
  return (
    <section aria-labelledby="setup" className="grid gap-3.5 rounded-[20px] border border-line bg-surface p-5">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2.5">
          <h2 id="setup" className="font-head text-[20px] font-bold">
            Set up in a minute
          </h2>
          <span className="font-head text-[15px] font-extrabold text-ink-2">{done} of 3 done</span>
        </div>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-line-soft">
          <span className="block h-full bg-marigold transition-[width] duration-300" style={{ width: `${(done / 3) * 100}%` }} />
        </div>
        <p className="text-[14px] text-ink-3">All optional. Anything you skip, we ask for when you send your first invite.</p>
      </div>
      {ACCOUNTS.map((a) => {
        const c = connected(a.platform);
        return (
          <div key={a.platform} className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className={`grid size-9 flex-none place-items-center rounded-[10px] ${a.mark}`}>
                {a.platform === "youtube" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 15.5v-7l6 3.5z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="4" y="4" width="16" height="16" rx="5" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                )}
              </span>
              <span>
                <b className="block text-[15px]">{a.name}</b>
                <small className="text-[13px] text-ink-3">{a.what}</small>
              </span>
            </div>
            {c ? (
              <span className="text-[13.5px] font-bold text-pass">Connected as {c.name}</span>
            ) : (
              <button type="button" onClick={() => void take(() => api.connectAccount(a.platform))} className={CONNECT}>
                Connect {a.name}
              </button>
            )}
          </div>
        );
      })}
      <div className="border-t border-line-soft pt-3.5">
        <EmailField
          label="Your PayPal email"
          value={me.paypalEmail}
          hint="We send your payment here. Check it: a payment to the wrong email can’t be pulled back."
          onSave={(email) => email && void take(() => api.setPaypalEmail(email))}
        />
      </div>
      {problem && <p className="text-[14px] font-bold text-fail">{problem}</p>}
    </section>
  );
}
