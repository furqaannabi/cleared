"use client";

import { useId, useState } from "react";
import { ConnectLink } from "@/components/connect/connect-link";
import type { Deliverable } from "@/lib/deliverable/types";
import type { Journey } from "@/lib/publish/journey";
import type { JourneyActions } from "./use-journey-actions";

export const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-espresso px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover disabled:opacity-50";
export const OUTLINE = "inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso disabled:opacity-50";
export const FIELD = "block w-full rounded-sm border border-latte-line bg-surface px-3 py-2.5 text-[16px] focus-visible:border-espresso";

/** This page's path, for coming back after reconnecting an account. */
const here = () => (typeof window === "undefined" ? "/" : window.location.pathname);

/**
 * The current step's action, opened in place where it needs more: the
 * video's link, posting, a corrected email; or a link to reconnect.
 *
 * @param d - the deliverable
 * @param view - its journey
 * @param actions - the creator's actions on it
 * @see docs/specs/publish-and-pay-frd.md PP-FR-01, PP-FR-06, PP-FR-07, PP-FR-20, PP-FR-37, PP-FR-38
 */
export function Act({ d, view, actions }: { d: Deliverable; view: Journey; actions: JourneyActions }) {
  const a = view.action;
  const id = useId();
  const [link, setLink] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [email, setEmail] = useState(d.payout?.email ?? d.payoutEmail);
  if (!a) return null;
  const problem = actions.problem && (
    <p role="alert" className="text-meta font-bold text-fail">
      {actions.problem}
      {/* PP-FR-37: a refusal that needs an account reconnected offers it. */}
      {actions.reconnect && (
        <>
          {" "}
          <ConnectLink platform={actions.reconnect} path={here()} className="text-espresso underline underline-offset-3">
            Reconnect {actions.reconnect === "youtube" ? "YouTube" : "Instagram"}
          </ConnectLink>
        </>
      )}
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

  // PP-FR-38 (1.3): the live check waits for the account to be connected again.
  if (a.kind === "reconnect")
    return (
      <ConnectLink platform={d.platform === "instagram_reel" ? "instagram" : "youtube"} path={here()} className={`${PRIMARY} justify-self-start`}>
        {a.label}
      </ConnectLink>
    );

  // PP-FR-01 (1.3): the go-ahead takes the unlisted YouTube video's link.
  if (a.kind === "get_go_ahead" && a.videoLink)
    return (
      <div className="grid gap-2">
        <label htmlFor={id} className="text-[13.5px] font-bold text-ink">
          Your unlisted video’s link
        </label>
        <input
          id={id}
          type="url"
          inputMode="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtu.be/…"
          aria-describedby={`${id}-hint`}
          className={FIELD}
        />
        <p id={`${id}-hint`} className="text-meta text-ink-3">
          Upload the approved draft to your channel as unlisted, then paste its link.
        </p>
        {problem}
        <button type="button" disabled={a.disabled || actions.busy} onClick={() => actions.getGoAhead(videoUrl)} className={`${PRIMARY} justify-self-start`}>
          {a.label}
        </button>
      </div>
    );

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
