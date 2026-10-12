import type { Metadata } from "next";
import { PrivacyPage } from "@/components/legal/privacy-page";

// LG-FR-14 (1.1): linked and indexed.
export const metadata: Metadata = { title: "Privacy policy · Cleared" };

/** LG-FR-05 to LG-FR-10: the privacy policy. */
export default function Page() {
  return <PrivacyPage />;
}
