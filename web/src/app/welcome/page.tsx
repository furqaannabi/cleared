import type { Metadata } from "next";
import { WelcomePage } from "@/components/welcome/welcome-page";

export const metadata: Metadata = { title: "Welcome · Cleared" };

/** SI-FR-08 to SI-FR-10: the welcome page, once per account. */
export default function Page() {
  return <WelcomePage />;
}
