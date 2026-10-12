import type { Metadata } from "next";
import { TermsPage } from "@/components/legal/terms-page";
import { legalPagesOn } from "@/lib/legal/flag";

// LG-FR-14: not indexed until the pages are linked.
export const metadata: Metadata = { title: "Terms · Cleared", robots: legalPagesOn() ? undefined : { index: false } };

/** LG-FR-11, LG-FR-12: the terms. */
export default function Page() {
  return <TermsPage />;
}
