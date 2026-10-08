import type { Metadata } from "next";
import { OpenLink } from "@/components/brand-deal/open-link";

// CH-BR-06: the token is in this URL until the swap, so it is never sent as a referrer or indexed.
export const metadata: Metadata = {
  title: "Opening your deal · Cleared",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** CH-FR-01, CH-FR-02: the brand's link. Swaps the token for a session, then moves to the deal's own URL. */
export default async function BrandLinkPage(props: PageProps<"/b/[token]">) {
  const { token } = await props.params;
  return <OpenLink token={token} />;
}
