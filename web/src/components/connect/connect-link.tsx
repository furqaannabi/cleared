"use client";

import type { ReactNode } from "react";
import { api, apiBaseUrl } from "@/lib/api";
import { connectHref, type ConnectPlatform } from "@/lib/connect/connect-result";
import { MOCKING_ENABLED } from "@/lib/mocking/mocking-enabled";

/**
 * "Connect YouTube" or "Connect Instagram": a link to the backend's connect
 * route, which leaves for Google or Instagram and comes back to `path` with
 * its result. Mock builds can't follow a real sign-in, so there the mock
 * connects the account and answers where to come back to, as the backend
 * would (removed with the mocks).
 *
 * @param platform - the account to connect
 * @param path - this page's path, to come back to
 * @see docs/specs/creator-invite-frd.md IN-FR-11 (1.3); docs/specs/sign-in-frd.md SI-FR-09
 */
export function ConnectLink({ platform, path, className, children }: { platform: ConnectPlatform; path: string; className: string; children: ReactNode }) {
  const mock = async (e: { preventDefault: () => void }) => {
    if (!MOCKING_ENABLED) return;
    e.preventDefault();
    const r = await api.mockConnect(platform, `${path}?connecting=${platform}`);
    if (r.ok) window.location.assign(r.data.location);
  };
  return (
    <a href={connectHref(apiBaseUrl, platform, path)} onClick={mock} className={className}>
      {children}
    </a>
  );
}
