import type { Metadata } from "next";
import { TermsPage } from "@/components/legal/terms-page";

// LG-FR-14 (1.1): linked and indexed.
export const metadata: Metadata = { title: "Terms · Cleared" };

/** LG-FR-11, LG-FR-12: the terms. */
export default function Page() {
  return <TermsPage />;
}
