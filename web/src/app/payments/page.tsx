import { PaymentsPage } from "@/components/home/payments-page";
import { AppShell } from "@/components/shell/app-shell";

/** HM-FR-23: `/payments`, the creator's Payments page (HM 1.4: no flag). */
export default function Payments() {
  return (
    <AppShell currentDealId={null} page="payments">
      <PaymentsPage />
    </AppShell>
  );
}
