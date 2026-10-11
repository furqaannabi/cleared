"use client";

import { useEffect, useState } from "react";
import { readConnectResult, type ConnectPlatform } from "@/lib/connect/connect-result";

/**
 * What came back from connecting an account, read once from the address when
 * the page opens, then taken out of it so a reload doesn't repeat it.
 *
 * @returns the card it is for and its message (null when it connected), or null
 * @see docs/specs/creator-invite-frd.md IN-FR-11 (1.3)
 */
export function useConnectResult() {
  const [result, setResult] = useState<{ platform: ConnectPlatform; message: string | null } | null>(null);
  useEffect(() => {
    const r = readConnectResult(window.location.search);
    if (!r) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${r.rest}${window.location.hash}`);
    // Read from the address after the first render: the server can't see it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult({ platform: r.platform, message: r.message });
  }, []);
  return result;
}
