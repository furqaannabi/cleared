"use client";

import { ErrorMessage } from "@/components/errors/error-message";

/** EP-FR-03: a crash on one of a deal's pages, inside the deal layout's app shell (the rail stays). */
export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="px-4">
      <ErrorMessage {...props} />
    </main>
  );
}
