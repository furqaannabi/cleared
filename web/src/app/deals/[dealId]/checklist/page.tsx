import { ChecklistPage } from "@/components/checklist-builder/checklist-page";

/** BC FRD: the brief and checklist for a deal at step 1 (inside the deal's app shell). */
export default async function DealChecklistPage(props: PageProps<"/deals/[dealId]/checklist">) {
  const { dealId } = await props.params;
  return <ChecklistPage dealId={dealId} />;
}
