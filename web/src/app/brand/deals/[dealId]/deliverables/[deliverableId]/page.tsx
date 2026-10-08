import type { Metadata } from "next";
import { BrandReviewPage } from "@/components/brand-review/brand-review-page";

export const metadata: Metadata = {
  title: "Review the draft · Cleared",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** RW FRD: the brand's review of one post, in the brand's own frame. Access is the deal-scoped session. */
export default async function BrandReview(props: PageProps<"/brand/deals/[dealId]/deliverables/[deliverableId]">) {
  const { dealId, deliverableId } = await props.params;
  return <BrandReviewPage dealId={dealId} deliverableId={deliverableId} />;
}
