import { HomePage } from "@/components/home/home-page";
import { AppShell } from "@/components/shell/app-shell";

/** HM-FR-01, LP-FR-15 (1.4): `/deals` is the creator's home (signing in and the landing page's button land here). */
export default function DealsPage() {
  return (
    <AppShell currentDealId={null} home>
      <HomePage />
    </AppShell>
  );
}
