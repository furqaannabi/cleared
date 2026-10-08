"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { BrandFrame, BrandMessage } from "./brand-frame";

/**
 * Opens a brand's link: swaps the token for a session (an HttpOnly cookie the
 * page never sees), then replaces the URL with the deal's, so the token
 * leaves the address bar and history. The token is never stored or logged.
 *
 * @param token - the link's token, from the URL
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-01, CH-FR-02, CH-BR-06
 */
export function OpenLink({ token }: { token: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<"dead" | "unreachable" | null>(null);
  // One swap per token, even when effects run twice in development.
  const asked = useRef<string | null>(null);

  const open = useCallback(async () => {
    const r = await api.openBrandLink(token);
    if (r.ok) router.replace(`/brand/deals/${encodeURIComponent(r.data.dealId)}`);
    // CH-FR-02: expired, turned off and unknown all look the same; only a network failure differs.
    else setProblem(r.error === "not_found" ? "dead" : "unreachable");
  }, [token, router]);

  useEffect(() => {
    if (asked.current === token) return;
    asked.current = token;
    void open();
  }, [token, open]);

  return (
    <BrandFrame>
      {problem === "dead" ? (
        <BrandMessage title="This link doesn’t work any more">Ask the creator who sent it for a new one.</BrandMessage>
      ) : problem === "unreachable" ? (
        <div className="py-10">
          <p role="alert" className="text-ink-2">
            We couldn’t reach Cleared. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setProblem(null);
              void open();
            }}
            className="mt-3 inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] font-bold text-espresso"
          >
            Try again
          </button>
        </div>
      ) : (
        <p role="status" className="py-10 text-ink-3">
          Opening your deal…
        </p>
      )}
    </BrandFrame>
  );
}
