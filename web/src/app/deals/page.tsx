import { OverviewPage } from "@/components/home/overview-page";
import { AppShell } from "@/components/shell/app-shell";

/** HM-FR-01, LP-FR-15 (1.4), HM 1.2: `/deals` is the creator's overview (signing in and the landing page's button land here). */
export default function DealsPage() {
  return (
    <AppShell currentDealId={null} page="overview">
      <OverviewPage />
    </AppShell>
  );
}
