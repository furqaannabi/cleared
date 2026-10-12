"use client";

import { ErrorMessage } from "@/components/errors/error-message";
import { AppShell } from "@/components/shell/app-shell";

/** EP-FR-03: a crash in the creator app keeps the rail (or top bar), so the deals are still reachable. */
export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AppShell currentDealId={null}>
      <main id="main" className="px-4">
        <ErrorMessage {...props} />
      </main>
    </AppShell>
  );
}
