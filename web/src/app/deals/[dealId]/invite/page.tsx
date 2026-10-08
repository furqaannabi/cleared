import { InvitePage } from "@/components/invite/invite-page";

/** IN FRD: amounts, deadlines, accounts, the PayPal email and the brand's link (inside the deal's app shell). */
export default async function DealInvitePage(props: PageProps<"/deals/[dealId]/invite">) {
  const { dealId } = await props.params;
  return <InvitePage dealId={dealId} />;
}
