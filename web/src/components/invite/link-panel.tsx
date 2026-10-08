"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useDemoBuild } from "@/components/mocking/demo-build";
import { api } from "@/lib/api";
import type { DealInvite } from "@/lib/invite/types";
import { ConfirmAction } from "./confirm-action";
import { SaveProblem } from "./save-problem";
import type { Save, SaveProblems } from "./save";

const noSubscribe = () => () => {};

/** "15 Oct", in the creator's own time zone. */
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

/**
 * The brand's link once it exists: the link with Copy and (where the browser
 * has one) Share, who can open it, when it expires, and who Cleared emailed it
 * to. The link only ever comes from the API; it is never stored or logged.
 *
 * @param invite - the deal's invite, with its link
 * @param save - runs a change against the API
 * @param problems - fields whose last save failed
 * @param onInvite - takes the invite with its new link
 * @see docs/specs/creator-invite-frd.md IN-FR-17, IN-FR-20, IN-BR-04
 */
export function LinkPanel({
  invite,
  save,
  problems,
  onInvite,
}: {
  invite: DealInvite & { link: NonNullable<DealInvite["link"]> };
  save: Save;
  problems: SaveProblems;
  onInvite: (invite: DealInvite) => void;
}) {
  const { link, brandName } = invite;
  const demo = useDemoBuild();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Share shows only where the browser has a share sheet; never on the server render.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="link-heading" className="grid gap-3 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 id="link-heading" className="font-head text-[17px] font-bold">
        Send this link to {brandName}
      </h2>
      {(invite.version ?? 1) > 1 && <p className="text-meta font-bold text-ink-2">Version {invite.version} sent</p>}
      {link.expired ? (
        <p className="font-bold">This link has expired.</p>
      ) : (
        <>
        <p className="truncate rounded-md border border-latte-line bg-latte-wash px-3.5 py-3 text-[15px] font-bold">{link.url}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center rounded-pill bg-espresso px-[18px] font-bold text-surface hover:bg-espresso-hover"
          >
            Copy link
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: `Cleared · ${brandName}`, url: link.url }).catch(() => {})}
              className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso hover:bg-latte-wash"
            >
              Share
            </button>
          )}
          <p role="status" className="self-center text-meta font-bold text-ink-2">
            {copied ? "Copied" : ""}
          </p>
        </div>
        <p className="text-meta text-ink-3">Anyone with this link can open this deal. Send it only to {brandName}.</p>
        <p className="text-meta text-ink-3">{`Expires on ${shortDate(link.expiresAt)}.`}</p>
        {link.emailedTo && <p className="text-meta text-ink-3">{`We’ve also emailed it to ${link.emailedTo}.`}</p>}
        {/* Mock builds only: open the brand's side in this browser (CH "Mocks"). */}
        {demo && (
          <Link href={`/b/${link.url.split("/b/")[1]}`} className="inline-flex min-h-11 items-center text-[14px] font-bold text-espresso underline underline-offset-3">
            Open as {brandName}
          </Link>
        )}
        </>
      )}
      <ConfirmAction
        label="Make a new link"
        warning="The old link will stop working."
        yes="Yes, make a new link"
        no="Keep this link"
        onConfirm={() => save("renew", () => api.renewInviteLink(invite.dealId), onInvite)}
      />
      <SaveProblem retry={problems.renew} />
    </section>
  );
}
