"use client";

import { useRef, useState } from "react";
import { ConnectLink } from "@/components/connect/connect-link";
import { useConnectResult } from "@/components/connect/use-connect-result";
import { api } from "@/lib/api";
import type { UnderWay } from "@/lib/api/client";
import type { CreatorProfile } from "@/lib/invite/types";
import type { AccountRow } from "@/lib/settings/settings-view";
import { OUTLINE, PRIMARY, TEXT_LINK } from "./styles";

const POST: Record<UnderWay["platform"], string> = { youtube_video: "YouTube video", youtube_short: "YouTube Short", instagram_reel: "Instagram Reel" };
const MARK = { youtube: "bg-[#FFE9E7] text-[#C4302B]", instagram: "bg-[#FCE3EC] text-[#9C2A55]" } as const;

/**
 * ST-FR-08: the posts under way, named, three at most and then how many more.
 *
 * @param label - the platform
 * @param posts - the API's posts in the way
 */
export function underWayLine(label: string, posts: UnderWay[]): string {
  const named = posts.slice(0, 3).map((p) => `${p.brandName} · ${POST[p.platform]}`);
  const more = posts.length > 3 ? ` and ${posts.length - 3} more` : "";
  return `You can’t disconnect ${label} while a post is under way: ${named.join(", ")}${more}.`;
}

/**
 * The connected-account rows: the account's name with Reconnect, or Connect;
 * and, behind the flag, Disconnect with its confirmation in place or the
 * API's refusal naming the posts under way.
 *
 * @param rows - each platform's row from the settings view
 * @param onMe - takes the profile a disconnect returned
 * @see docs/specs/settings-frd.md ST-FR-06 to ST-FR-08
 */
export function AccountRows({ rows, onMe }: { rows: AccountRow[]; onMe: (me: CreatorProfile) => void }) {
  const result = useConnectResult();
  return (
    <div className="grid">
      {rows.map((row) => (
        <Row key={row.platform} row={row} onMe={onMe} result={result?.platform === row.platform ? result.message : null} />
      ))}
    </div>
  );
}

function Row({ row, onMe, result }: { row: AccountRow; onMe: (me: CreatorProfile) => void; result: string | null | undefined }) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disconnect = useRef<HTMLButtonElement>(null);

  async function confirm() {
    setBusy(true);
    const r = await api.disconnectAccount(row.platform);
    setBusy(false);
    setConfirming(false);
    if (r.ok) return onMe(r.data);
    if ("blocking" in r) return setProblem(underWayLine(row.label, r.blocking));
    setProblem(r.error === "signed_out" ? "You’ve been signed out. Sign in again to carry on." : "That didn’t go through. Try again.");
  }

  return (
    <div className="border-t border-line-soft py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className={`grid size-9 flex-none place-items-center rounded-[10px] ${MARK[row.platform]}`}>
          {row.platform === "youtube" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.5 7v10l8.5-5z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="4" y="4" width="16" height="16" rx="5" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">{row.name ?? row.label}</b>
          <small className="text-[13.5px] text-ink-3">
            {row.name ? `${row.label} · connected` : row.platform === "instagram" ? "Not connected. Professional accounts only." : "Not connected."}
          </small>
          {/* ST-FR-08 (1.3): in use by a post under way, so no Disconnect yet. */}
          {row.inUse && (
            <small className="mt-0.5 block text-[13.5px] text-ink-2">In use by a post under way. You can disconnect it once that post is paid or its hold goes back.</small>
          )}
        </span>
        {row.name ? (
          <span className="flex gap-3.5 max-[420px]:w-full max-[420px]:pl-12">
            <ConnectLink platform={row.platform} path="/settings" className={TEXT_LINK}>
              <span aria-hidden="true">Reconnect</span>
              <span className="sr-only">Reconnect {row.label}</span>
            </ConnectLink>
            {row.disconnect && (
              <button
                ref={disconnect}
                type="button"
                aria-label={`Disconnect ${row.label}`}
                onClick={() => {
                  setProblem(null);
                  setConfirming(true);
                }}
                className={`${TEXT_LINK} text-ink-3`}
              >
                Disconnect
              </button>
            )}
          </span>
        ) : (
          <ConnectLink platform={row.platform} path="/settings" className={OUTLINE}>
            Connect {row.label}
          </ConnectLink>
        )}
      </div>
      {result && (
        <p role="alert" className="mt-1.5 pl-12 text-meta font-semibold text-fail">
          {result}
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-1.5 pl-12 text-[13.5px] font-bold text-fail">
          {problem}
        </p>
      )}
      {confirming && (
        <div className="mt-2 ml-12 rounded-[10px] bg-latte-wash px-3 py-2.5 text-[13.5px] text-ink-2">
          <p>
            <b className="text-ink">Disconnect {row.name}?</b> Cleared stops reading it. You can connect it again later.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void confirm()} className={PRIMARY}>
              Disconnect
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                requestAnimationFrame(() => disconnect.current?.focus());
              }}
              className={OUTLINE}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
