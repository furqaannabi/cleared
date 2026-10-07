import { AppShell } from "@/components/shell/app-shell";
import { FirstDealRedirect } from "@/components/shell/first-deal-redirect";

/** LP-FR-15: `/deals` opens the creator's first deal (the landing page's button lands here). */
export default function DealsPage() {
  return (
    <AppShell currentDealId={null}>
      <FirstDealRedirect />
    </AppShell>
  );
}
