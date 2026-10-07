import { DealRedirect } from "@/components/shell/deal-redirect";

/** DC-FR-37: a deal opens the deliverable that needs the creator. */
export default async function DealPage(props: PageProps<"/deals/[dealId]">) {
  const { dealId } = await props.params;
  return <DealRedirect dealId={dealId} />;
}
