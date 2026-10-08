import type { Metadata } from "next";
import { BrandDealPage } from "@/components/brand-deal/brand-deal-page";

export const metadata: Metadata = {
  title: "Your deal · Cleared",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** CH FRD: the brand's deal page, in the brand's own frame (no rail). Access is the deal-scoped session. */
export default async function BrandDeal(props: PageProps<"/brand/deals/[dealId]">) {
  const { dealId } = await props.params;
  return <BrandDealPage dealId={dealId} />;
}
