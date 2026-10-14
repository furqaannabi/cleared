import type { Metadata } from "next";
import { DataDeletionPage } from "@/components/legal/data-deletion-page";

// LG-FR-14 (1.1): linked and indexed.
export const metadata: Metadata = { title: "Deleting your data · Sponing" };

/** LG-FR-13: how to delete an account, and what is kept. */
export default function Page() {
  return <DataDeletionPage />;
}
