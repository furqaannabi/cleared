import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";

/**
 * The brand's slim frame: the Cleared logo and, once the deal is known,
 * "{creator} invited {brand}". No rail and none of the creator's navigation.
 *
 * @param invited - the creator and brand, when known
 * @param children - the page
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-04
 */
export function BrandFrame({ invited, children }: { invited?: { creator: string; brand: string }; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-espresso-deep px-4 py-3 md:px-8">
        <Logo compact />
        {invited && (
          <p className="text-[14px] text-white/80">
            {invited.creator} invited <b className="text-white">{invited.brand}</b>
          </p>
        )}
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pt-[22px] pb-36 md:px-8 md:pt-8 lg:pb-16">{children}</main>
    </div>
  );
}

/**
 * A short message in place of the deal, with a heading and one line of what to do.
 *
 * @param title - the heading
 * @param children - what to do next
 */
export function BrandMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="max-w-[60ch] py-10">
      <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{title}</h1>
      <p className="mt-2 text-ink-2">{children}</p>
    </section>
  );
}
