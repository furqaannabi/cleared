"use client";

import type { ReactNode } from "react";
import { apiBaseUrl } from "@/lib/api";
import { connectHref, type ConnectPlatform } from "@/lib/connect/connect-result";

/**
 * "Connect YouTube" or "Connect Instagram": a link to the backend's connect
 * route, which leaves for Google or Instagram and comes back to `path` with
 * its result.
 *
 * @param platform - the account to connect
 * @param path - this page's path, to come back to
 * @see docs/specs/creator-invite-frd.md IN-FR-11 (1.3); docs/specs/sign-in-frd.md SI-FR-09
 */
export function ConnectLink({ platform, path, className, children }: { platform: ConnectPlatform; path: string; className: string; children: ReactNode }) {
  return (
    <a href={connectHref(apiBaseUrl, platform, path)} className={className}>
      {children}
    </a>
  );
}
