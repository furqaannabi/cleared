import { AppShell } from "@/components/shell/app-shell";
import { NewDealPage } from "@/components/new-deal/new-deal-page";

/** BC-FR-01 to BC-FR-03, BC-FR-21: start a deal with its brand and posts. */
export default function NewDealRoute() {
  return (
    <AppShell currentDealId={null}>
      <NewDealPage />
    </AppShell>
  );
}
