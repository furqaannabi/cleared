import Image from "next/image";
import type { ReactNode } from "react";
import { Seal } from "@/components/ui/seal";
import { StatusChip } from "@/components/checklist/status-chip";
import { StatusSeal } from "@/components/checklist/status-seal";
import { MoneyCard } from "@/components/money/money-card";
import { exampleChecklist, exampleDeliverable, exampleItems, examplePayout } from "./example";

/**
 * How a deal runs, as one example deal from start to paid: five steps joined
 * by a marigold thread, each with a number seal and a panel showing the app
 * at that moment.
 *
 * @see docs/specs/landing-frd.md LP-FR-09, LP-FR-06
 */
export function DealSteps() {
  const steps: { title: string; text: string; panel: ReactNode }[] = [
    { title: "Agree the checklist", text: "You and the brand agree the checklist the AI drew from the brief. Every item cites its line.", panel: <Checklist /> },
    { title: "Money held in PayPal", text: "The brand’s money is reserved, not taken. You can see it before you film.", panel: <MoneyCard deliverable={exampleDeliverable} timeZone="UTC" /> },
    { title: "AI checks your draft", text: "Item by item, with timestamps you can play. Unsure goes to a person, never a guess.", panel: <DraftCheck /> },
    { title: "48-hour review", text: "The brand reviews before you publish. Silence clears a fully passing draft.", panel: <Review /> },
    { title: "Publish, get paid", text: "The live check confirms the post, and the hold is paid out to you.", panel: <Payout /> },
  ];
  return (
    <section aria-labelledby="deal-heading" className="mx-auto max-w-[1180px] px-4 md:px-8">
      <h2 id="deal-heading" className="sr-only">How a deal runs</h2>
      <p className="text-[12.5px] font-extrabold tracking-[0.08em] text-ink-3 uppercase">Example deal · Glow Theory · one YouTube video</p>
      <ol aria-label="How a deal runs" className="lp-deal relative py-2">
        {steps.map((step, i) => (
          <li key={step.title} className="lp-band relative grid gap-4 py-[22px] pb-[34px] pl-[68px] lg:grid-cols-2 lg:items-center lg:gap-24 lg:py-10 lg:pl-0">
            <span className="lp-num absolute top-[18px] left-0 lg:top-1/2 lg:left-1/2 lg:-mt-[26px] lg:-ml-[26px]">
              <Seal fillClassName="fill-marigold" className="size-[52px]">
                <span className="font-head text-[19px] font-extrabold text-marigold-ink">{i + 1}</span>
              </Seal>
            </span>
            <div className={`lp-copy ${i % 2 === 1 ? "lg:order-2" : ""}`}>
              <h3 className="font-head text-[28px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[38px]">{step.title}</h3>
              <p className="mt-2 max-w-[40ch] text-[17px] text-ink-2">{step.text}</p>
            </div>
            <div className="lp-panel">{step.panel}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-[20px] border border-line bg-surface p-[18px] shadow-[0_1px_2px_rgb(28_21_10/0.05)]">{children}</div>;
}

function Checklist() {
  return (
    <Panel>
      <ul>
        {exampleChecklist.map((c) => (
          <li key={c.line} className="flex items-center gap-2.5 border-b border-line-soft py-2 text-[14.5px] last:border-0">
            <StatusSeal status="passed" className="size-6" />
            <span>{c.text}</span>
            <span className="ml-auto rounded-pill bg-latte px-2 py-0.5 text-[12.5px] whitespace-nowrap text-ink-3">Brief line {c.line}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DraftCheck() {
  return (
    <div>
      <div className="relative mb-3 aspect-video overflow-hidden rounded-[14px] bg-espresso">
        <Image src="/landing/draft-frame.jpg" alt="" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
        <span className="absolute top-2.5 right-2.5"><StatusSeal status="fix_needed" className="size-[34px]" /></span>
        <span className="absolute bottom-2.5 left-2.5 rounded-pill bg-espresso-ink/80 px-2 py-[3px] text-xs font-bold text-white">3:15 · Code shown as GLOW2O</span>
      </div>
      <ul className="rounded-[20px] border border-line bg-surface py-1.5">
        {exampleItems.map((item) => (
          <li key={item.name} className="grid grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0">
            <span className="lp-result">
              <span className="lp-was"><StatusSeal status="checking" className="size-[30px]" /></span>
              <span className="lp-now"><StatusSeal status={item.status} className="size-[30px]" /></span>
            </span>
            <span>
              <b className="block text-[15px]">{item.name}</b>
              <span className="text-[13px] text-ink-3">{item.meta}</span>
            </span>
            <span className="lp-result">
              <span className="lp-was"><StatusChip status="checking" brandName="Glow Theory" /></span>
              <span className="lp-now"><StatusChip status={item.status} brandName="Glow Theory" /></span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Review() {
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <StatusSeal status="waiting_for_brand" className="size-[46px]" />
        <div>
          <p className="sr-only">47 hours 59 minutes left in the review window.</p>
          <div aria-hidden="true" className="flex gap-1 font-head text-[30px] font-extrabold">
            <span className="rounded-lg bg-espresso-ink px-2 text-marigold">47</span>
            <span className="self-center text-ink-4">:</span>
            <span className="rounded-lg bg-espresso-ink px-2 text-marigold">59</span>
            <span className="self-center text-ink-4">:</span>
            <span className="lp-sec rounded-lg bg-espresso-ink px-2 text-marigold" />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">Glow Theory’s review window. Silence clears a fully passing draft.</p>
        </div>
      </div>
    </Panel>
  );
}

function Payout() {
  return (
    <Panel>
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <ul>
          {examplePayout.map((p) => (
            <li key={p.stage} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b border-line-soft py-2 text-[15px] font-bold last:border-0">
              <StatusSeal status="passed" className="size-6" />
              {p.stage}
              <span className="ml-auto text-[13px] font-semibold text-ink-3">PayPal {p.reference}</span>
            </li>
          ))}
        </ul>
        <span className="lp-cleared grid size-[88px] -rotate-12 place-items-center lg:size-[104px]">
          <Seal fillClassName="fill-pass" className="size-full">
            <span className="font-head text-[12px] font-extrabold tracking-[0.12em] text-white lg:text-[14px]">CLEARED</span>
          </Seal>
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-3">$1,200.00 · every stage with its PayPal reference.</p>
    </Panel>
  );
}
