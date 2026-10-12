import type { Metadata } from "next";
import { PrivacyPage } from "@/components/legal/privacy-page";
import { legalPagesOn } from "@/lib/legal/flag";

// LG-FR-14: not indexed until the pages are linked.
export const metadata: Metadata = { title: "Privacy policy · Cleared", robots: legalPagesOn() ? undefined : { index: false } };

/** LG-FR-05 to LG-FR-10: the privacy policy. */
export default function Page() {
  return <PrivacyPage />;
}
