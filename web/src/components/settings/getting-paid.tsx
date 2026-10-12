"use client";

import type { components } from "contract";
import { useId, useRef, useState } from "react";
import { KeepingEmail } from "@/components/invite/keeping-email";
import { api } from "@/lib/api";
import { looksLikeEmail } from "@/lib/email/looks-like-email";
import type { CreatorProfile } from "@/lib/invite/types";
import { FIELD, OUTLINE, PRIMARY, TEXT_LINK } from "./styles";

const HINT = "We send your payment here. Check it: a payment to the wrong email can’t be pulled back.";

/**
 * The PayPal email: shown, and changed in place with IN-FR-12's check and
 * line; after saving, the payouts already with PayPal that keep the old one.
 *
 * @param me - the creator's profile
 * @param onMe - takes the profile the save returned
 * @see docs/specs/settings-frd.md ST-FR-04, ST-FR-05
 */
export function GettingPaid({ me, onMe }: { me: CreatorProfile; onMe: (me: CreatorProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(me.paypalEmail ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState<components["schemas"]["PostKeepingEmail"][] | null>(null);
  const change = useRef<HTMLButtonElement>(null);
  const id = useId();

  async function save() {
    const email = text.trim();
    if (!looksLikeEmail(email)) return setProblem("Enter an email, like name@example.com");
    setBusy(true);
    const r = await api.setPaypalEmail(email);
    setBusy(false);
    if (!r.ok) return setProblem(r.error === "signed_out" ? "You’ve been signed out. Sign in again to carry on." : "That didn’t save. Try again.");
    onMe(r.data);
    setKept(r.data.postsKeepingEmail);
    setEditing(false);
  }

  if (editing)
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-body-strong font-bold">
          Your PayPal email
        </label>
        <input
          id={id}
          type="email"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={`${FIELD} ${problem ? "border-fail ring-1 ring-fail" : ""}`}
        />
        <p id={`${id}-hint`} className="mt-1.5 text-meta text-ink-3">
          {problem && <b className="block text-fail">{problem}</b>}
          {HINT}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void save()} className={PRIMARY}>
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setProblem(null);
              setText(me.paypalEmail ?? "");
              requestAnimationFrame(() => change.current?.focus());
            }}
            className={OUTLINE}
          >
            Keep it
          </button>
        </div>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{me.paypalEmail ?? "Add the email we pay you at."}</p>
          {me.paypalEmail && <p className="text-[13.5px] text-ink-3">Every payout goes here, after Cleared’s 5% fee.</p>}
          <p aria-live="polite" className="text-[13.5px] font-bold text-pass">
            {kept ? "Saved." : ""}
          </p>
        </div>
        <button ref={change} type="button" aria-label={me.paypalEmail ? "Change your PayPal email" : "Add your PayPal email"} onClick={() => setEditing(true)} className={TEXT_LINK}>
          {me.paypalEmail ? "Change" : "Add"}
        </button>
      </div>
      {kept && <KeepingEmail posts={kept} />}
    </div>
  );
}
