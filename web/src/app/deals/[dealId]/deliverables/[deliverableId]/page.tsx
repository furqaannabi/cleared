import type { Metadata } from "next";
import { DraftCheckPage } from "@/components/draft-check/draft-check-page";

export const metadata: Metadata = { title: "Draft check · Cleared" };

/**
 * DC-FR-35: the creator's draft check page for one deliverable. Ids are
 * opaque values from the API; no names appear in the URL.
 */
export default async function Page(props: PageProps<"/deals/[dealId]/deliverables/[deliverableId]">) {
  const { dealId, deliverableId } = await props.params;
  return <DraftCheckPage dealId={dealId} deliverableId={deliverableId} />;
}
