"use client";

import { Analytics } from "@vercel/analytics/next";
import { cleanPageView } from "@/lib/analytics/clean-page-view";

/**
 * Vercel Web Analytics, page views only, each address cleaned in the browser
 * before it is sent (no invite token, no query string).
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-17 (1.4); docs/decisions/2026-10-17-vercel-web-analytics.md
 */
export function PageAnalytics() {
  return <Analytics beforeSend={cleanPageView} />;
}
