import { StatusSeal } from "@/components/checklist/status-seal";
import { Seal } from "@/components/ui/seal";

const RULES = [
  { title: "The AI never moves money", text: "It finds evidence. Fixed code decides and calls PayPal." },
  { title: "Unsure goes to a person", text: "Never rounded up to a pass, never a guess." },
  { title: "A missed deadline returns the hold", text: "Fair both ways: no post, no payment." },
  { title: "Only a full pass clears on a timer", text: "Anything failed or unsure waits for you or the brand." },
];

/**
 * The four promises, each from PRODUCT.md's locked rules, with a pass seal.
 *
 * @see docs/specs/landing-frd.md LP-FR-10
 */
export function Rules() {
  return (
    <section aria-labelledby="rules-heading" className="mx-auto mt-10 max-w-[1180px] px-4 md:px-8">
      <h2 id="rules-heading" className="font-head text-[28px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[38px]">
        Rules that protect you
      </h2>
      <ul className="mt-6 grid gap-3.5 lg:grid-cols-4">
        {RULES.map((r, i) => (
          <li key={r.title} className="lp-rule rounded-[18px] border border-line bg-surface p-5">
            <span className={`mb-2.5 inline-block ${i % 2 ? "rotate-6" : "-rotate-[8deg]"}`}>
              <StatusSeal status="passed" className="size-11" />
            </span>
            <h3 className="font-head text-lg leading-tight font-extrabold">{r.title}</h3>
            <p className="mt-1 text-[14.5px] text-ink-2">{r.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the brand gets, in one short block with the lock seal.
 *
 * @see docs/specs/landing-frd.md LP-FR-11
 */
export function ForTheBrand() {
  return (
    <section
      aria-labelledby="brand-heading"
      className="mx-auto mt-14 grid max-w-[1116px] gap-3 rounded-3xl bg-latte p-7 md:mx-8 lg:mx-auto lg:grid-cols-[auto_1fr] lg:items-center lg:gap-6 lg:p-9"
    >
      <Seal fillClassName="fill-espresso" className="size-16">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-marigold">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </Seal>
      <div>
        <h2 id="brand-heading" className="font-head text-[28px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[38px]">
          For the brand
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-[17px] text-ink-2">
          Your money is held, not paid, until the approved post is live and checked. You review the draft before it’s published.
        </p>
      </div>
    </section>
  );
}
