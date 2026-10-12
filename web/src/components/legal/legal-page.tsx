import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/closing-and-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal/flag";

/** One block of a section: a paragraph, or a list. */
export type LegalBlock = string | { list: string[] };

/** One section of a legal page, with its anchor id. */
export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/**
 * The reading layout shared by the legal pages: the landing page's header
 * and footer, the title, "Last updated", the project line, the sections
 * listed first (a sticky column from `lg:`), the sections, and the contact.
 * Static and the same for everyone.
 *
 * @param title - the page's one h1
 * @param sections - the page's sections, in order
 * @param after - anything after the sections and before the contact
 * @see docs/specs/legal-pages-frd.md LG-FR-01 to LG-FR-04, LG-FR-16
 */
export function LegalPage({ title, sections, after }: { title: string; sections: LegalSection[]; after?: ReactNode }) {
  return (
    <div className="overflow-x-clip">
      <LandingHeader />
      <main id="main" className="mx-auto max-w-[1180px] px-4 pt-6 pb-10 md:px-8 lg:grid lg:grid-cols-[220px_minmax(0,70ch)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <div className="lg:col-start-2">
          <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{title}</h1>
          <p className="mt-1 text-meta text-ink-3">Last updated {LEGAL_UPDATED}</p>
          <p className="mt-2 text-[14px] text-ink-2">Written for the Cleared hackathon project. Not reviewed by a lawyer.</p>
        </div>
        <nav aria-label="On this page" className="mt-6 lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-start">
          <p className="text-label font-bold text-ink-3">On this page</p>
          <ul className="mt-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-espresso underline decoration-latte-line underline-offset-3 lg:min-h-9">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lg:col-start-2">
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={s.id} className="mt-8">
              <h2 id={s.id} className="scroll-mt-6 font-head text-section-title font-bold">
                {s.heading}
              </h2>
              {s.blocks.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i} className="mt-3 text-ink-2">
                    {b}
                  </p>
                ) : (
                  <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-ink-2 marker:text-ink-4">
                    {b.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
          {after}
          <p className="mt-10 border-t border-line pt-5 text-ink-2">
            Questions or requests:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-espresso underline underline-offset-3">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
