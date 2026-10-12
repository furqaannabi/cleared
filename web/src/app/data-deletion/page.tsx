import type { Metadata } from "next";
import { DataDeletionPage } from "@/components/legal/data-deletion-page";
import { legalPagesOn } from "@/lib/legal/flag";

// LG-FR-14: not indexed until the pages are linked.
export const metadata: Metadata = { title: "Deleting your data · Cleared", robots: legalPagesOn() ? undefined : { index: false } };

/** LG-FR-13: how to delete an account, and what is kept. */
export default function Page() {
  return <DataDeletionPage />;
}
