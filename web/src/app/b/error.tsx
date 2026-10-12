"use client";

import { BrandFrame } from "@/components/brand-deal/brand-frame";
import { ErrorMessage } from "@/components/errors/error-message";

/** EP-FR-03: a crash on the brand's pages keeps the slim brand frame. */
export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <BrandFrame>
      <ErrorMessage {...props} />
    </BrandFrame>
  );
}
