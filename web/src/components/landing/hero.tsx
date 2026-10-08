import Image from "next/image";
import { StatusSeal } from "@/components/checklist/status-seal";
import { MoneyCard } from "@/components/money/money-card";
import { InstagramOnlyNote, SignInButtons } from "@/components/session/sign-in-buttons";
import { DemoNote } from "./demo-button";
import { exampleDeliverable, exampleItems } from "./example";

/**
 * The opening screen: the tagline as the page's only h1, one sentence, the one
 * action with its demo note, and the product itself: a phone showing the
 * example deal with the held money card beside it.
 *
 * @see docs/specs/landing-frd.md LP-FR-02 to LP-FR-07, LP-FR-16
 */
export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1180px] items-center gap-9 px-4 pt-7 pb-10 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-14 lg:pb-[72px]">
      <div>
        <h1 className="max-w-[15ch] font-head text-[42px] leading-[1.02] font-extrabold tracking-[-0.02em] lg:text-[70px]">
          Brand deals where the content and the payment{" "}
          <span className="bg-[linear-gradient(transparent_62%,var(--color-marigold)_62%,var(--color-marigold)_92%,transparent_92%)] px-[0.06em]">
            clear together
          </span>
          .
        </h1>
        <p className="mt-[18px] mb-6 max-w-[34ch] text-lg text-ink-2">
          The brand’s money is held in PayPal, AI checks your video against the brief, and you’re paid when the approved post is live.
        </p>
        {/* LP-FR-03 (1.2): the two ways in (SI-FR-01, SI-FR-02). */}
        <SignInButtons />
        <div className="mt-2.5 grid gap-1">
          <InstagramOnlyNote />
        </div>
        <DemoNote />
      </div>
      <HeroPhone />
    </section>
  );
}

function HeroPhone() {
  const marks = [
    { left: "6%", status: "passed" },
    { left: "24%", status: "passed" },
    { left: "48%", status: "fix_needed" },
    { left: "72%", status: "passed" },
  ] as const;
  return (
    <figure aria-label="An example deal with made-up data" className="relative h-[430px] w-[min(100%,400px)] justify-self-center lg:h-[470px]">
      <div className="absolute top-0 left-5 h-[430px] w-[232px] rounded-[38px] bg-espresso-ink p-2.5 shadow-[0_30px_60px_rgb(28_21_10/0.25)] lg:h-[470px] lg:w-[250px]">
        <div className="h-full overflow-hidden rounded-[30px] bg-ground px-3 py-4">
          <p className="font-head text-[15px] leading-tight font-extrabold">Glow Theory · YouTube video</p>
          <p className="mb-2.5 text-[11px] text-ink-3">Draft check, run 2</p>
          <div className="relative mb-2 h-[118px] overflow-hidden rounded-xl bg-espresso">
            <Image src="/landing/draft-frame.jpg" alt="" fill sizes="232px" className="object-cover" priority />
            <span aria-hidden="true" className="absolute top-[40%] left-[44%] border-y-[10px] border-l-[16px] border-y-transparent border-l-white/90" />
          </div>
          <div aria-hidden="true" className="relative mx-1 mt-1 mb-2 h-[30px] before:absolute before:inset-x-0 before:top-5 before:h-[5px] before:rounded-pill before:bg-line-soft">
            {marks.map((m, i) => (
              <span key={m.left} className="lp-pop absolute top-0" style={{ left: m.left, animationDelay: `${300 + i * 150}ms` }}>
                <StatusSeal status={m.status} className="size-[22px]" />
              </span>
            ))}
          </div>
          <ul className="grid gap-1.5">
            {exampleItems.map((item) => (
              <li
                key={item.short}
                className={`flex items-center gap-2 rounded-[10px] border px-2 py-[7px] text-[11.5px] font-bold ${
                  item.status === "fix_needed" ? "border-fail-line bg-fail-tint" : "border-line bg-surface"
                }`}
              >
                <StatusSeal status={item.status} className="size-[18px]" />
                {item.short}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* The full money card at its natural width, scaled down to sit beside the phone. */}
      <div className="lp-bob absolute right-0 bottom-9 w-[310px] origin-bottom-right -rotate-[4deg] scale-[0.78]">
        <MoneyCard deliverable={exampleDeliverable} timeZone="UTC" />
      </div>
      <span aria-hidden="true" className="lp-stamp absolute top-[70px] left-0 -rotate-[10deg]">
        <StatusSeal status="passed" className="size-16" />
      </span>
      <figcaption className="absolute inset-x-0 -bottom-7 text-center text-[12.5px] text-ink-3">An example deal with made-up data.</figcaption>
    </figure>
  );
}
