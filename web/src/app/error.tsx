"use client";

import { ErrorMessage } from "@/components/errors/error-message";

/** EP-FR-03: a crash on a page outside the creator app and the brand's pages (the landing, the legal pages, sign-in). */
export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="min-h-dvh px-4">
      <ErrorMessage {...props} />
    </main>
  );
}
