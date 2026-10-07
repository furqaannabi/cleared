import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Cleared: brand deals where the content and the payment clear together",
  description:
    "The brand’s money is held in PayPal, AI checks your video against the brief, and you’re paid when the approved post is live.",
};

/** The landing page (docs/specs/landing-frd.md): static, a Server Component. */
export default function Home() {
  return <LandingPage />;
}
