import { notFound } from "next/navigation";
import { PaymentsPage } from "@/components/home/payments-page";
import { AppShell } from "@/components/shell/app-shell";
import { PAYMENTS } from "@/lib/home/flag";

/** HM-FR-23: `/payments`, only with the payments flag on; with it off, the not-found page (HM-FR-20, EP-FR-01). */
export default function Payments() {
  if (!PAYMENTS) notFound();
  return (
    <AppShell currentDealId={null} page="payments">
      <PaymentsPage />
    </AppShell>
  );
}
