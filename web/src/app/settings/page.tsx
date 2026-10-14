import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Settings · Sponing" };

/** ST-FR-01: the creator's settings, signed in only, in the creator frame. */
export default function Page() {
  return (
    <AppShell currentDealId={null}>
      <SettingsPage />
    </AppShell>
  );
}
