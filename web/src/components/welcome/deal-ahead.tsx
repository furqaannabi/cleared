import { Seal } from "@/components/ui/seal";

const STEPS = [
  { when: "Before you start", title: "The money is held before you start.", body: "Your brand’s payment is held in PayPal before you make anything.", icon: <><rect x="7.5" y="11" width="9" height="7" rx="1.5" /><path d="M9.7 11V9a2.3 2.3 0 0 1 4.6 0v2" /></> },
  { when: "Before you publish", title: "No surprises at review.", body: "We check your draft against the brief before you publish, and the brand has 48 hours to object.", icon: <path d="M9 7.5h6M9 11h6M9 14.5h4" /> },
  { when: "When it’s live", title: "Paid when your post goes live.", body: "Once the live check passes, the money comes to your PayPal. No chasing invoices.", icon: <path d="M8 12.5l3 3 5-6" /> },
];

/**
 * Cleared's promise, drawn as the deal ahead (design C): three steps on the
 * landing's dashed marigold thread, down the page on phones and across from
 * `lg:`. Each names when it happens, what Cleared does and what it means.
 *
 * @see docs/specs/sign-in-frd.md SI-FR-08; design/sign-in/option-c.html
 */
export function DealAhead() {
  return (
    <ol aria-label="The deal ahead" className="relative mt-8 grid gap-6 lg:grid-cols-3">
      <span aria-hidden="true" className="absolute top-[30px] bottom-[30px] left-[21px] border-l-[3px] border-dashed border-marigold lg:top-[21px] lg:right-[30px] lg:bottom-auto lg:left-[30px] lg:border-t-[3px] lg:border-l-0" />
      {STEPS.map((s) => (
        <li key={s.title} className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-3.5 gap-y-1 lg:grid-cols-1">
          <span className="row-span-3 size-11 rounded-full bg-ground lg:row-span-1">
            <Seal fillClassName="fill-marigold" className="size-11 text-espresso-ink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full scale-[1.9]">
                {s.icon}
              </svg>
            </Seal>
          </span>
          <span className="text-[12.5px] font-extrabold tracking-[0.02em] text-marigold-ink-2 uppercase">{s.when}</span>
          <b className="text-[17px] leading-snug">{s.title}</b>
          <span className="text-[15px] text-ink-2">{s.body}</span>
        </li>
      ))}
    </ol>
  );
}
