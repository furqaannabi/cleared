import Link from "next/link";
import { Seal } from "@/components/ui/seal";
import type { ReactNode } from "react";
import type { MoneyOverview, MoneyTotal } from "@/lib/home/money-overview";
import { ArrowIcon, CheckIcon, ClockIcon, CrossIcon, LockIcon } from "./icons";

function Stage({ icon, label, total, big = false, children }: { icon: ReactNode; label: string; total: MoneyTotal; big?: boolean; children?: ReactNode }) {
  return (
    <div className="px-[18px] py-4 text-espresso-ink not-first:border-t not-first:border-espresso/14 lg:px-[26px] lg:py-[22px] lg:not-first:border-t-0 lg:not-first:border-l">
      <p className="flex items-center gap-2 text-[13.5px] font-bold text-ink-2">
        {icon}
        {label}
      </p>
      <p className={`mt-1 font-head font-extrabold tracking-[-0.01em] tabular-nums ${big ? "text-[34px] leading-[1.05] lg:text-amount" : "text-[30px] leading-[1.1] lg:text-[34px]"}`}>{total.text}</p>
      <p className="mt-0.5 text-[13px] text-ink-2">{total.posts}</p>
      {children}
    </div>
  );
}

/**
 * (HM 1.6) Latte, not marigold: espresso figures, labels in the ink ramp and
 * the seal in espresso; only the deal page's money card stays marigold.
 *
 * The money card stretched into home's headline: held for you, on its way and
 * paid, in a row from `lg:` and stacked on phones, with Paid the largest and
 * "See payments" under it. A white footer says the totals are after the fee and names any stuck payout,
 * linking to its post.
 *
 * @param overview - the totals and the stuck payouts
 * @see docs/specs/creator-home-frd.md HM-FR-05 to HM-FR-07, HM-FR-25; DESIGN.md "Overview and Payments"
 */
export function MoneyCard({ overview }: { overview: MoneyOverview }) {
  return (
    <section aria-label="Your money" className="relative mt-4 overflow-hidden rounded-lg border border-latte-line bg-latte shadow-money-card-latte">
      <span aria-hidden="true" className="pointer-events-none absolute -top-[90px] -right-[70px] size-[220px] rounded-full bg-white/45" />
      <Seal fillClassName="fill-espresso" className="absolute top-4 right-[18px] z-[1] size-[46px] lg:right-[26px]">
        <LockIcon className="size-full text-latte" />
      </Seal>
      <div className="relative grid lg:grid-cols-[1fr_1fr_1.15fr]">
        <Stage icon={<LockIcon />} label="Held for you" total={overview.held} />
        <Stage icon={<ClockIcon />} label="On its way" total={overview.onItsWay} />
        <Stage icon={<CheckIcon />} label="Paid" total={overview.paid} big>
          <Link href="/payments" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-espresso-ink underline decoration-espresso/35 underline-offset-3">
            See payments
            <ArrowIcon className="size-[15px]" />
          </Link>
        </Stage>
      </div>
      <div className="relative grid gap-1 bg-surface px-[18px] py-3 lg:px-[26px]">
        {/* HM-FR-05 (1.4): held money is the deal amount; the other two are what is received. */}
        <p className="text-[13.5px] text-ink-3">On its way and Paid are what you receive, after Sponing’s 5% fee.</p>
        {overview.stuck.lines.length > 0 && (
          <ul>
            {overview.stuck.lines.map((line) => (
              <li key={line.href}>
                <Link href={line.href} className="flex min-h-11 items-center gap-2 text-[14px] text-fail underline decoration-fail-line underline-offset-3">
                  <CrossIcon className="size-[18px] flex-none" />
                  {line.text}
                </Link>
              </li>
            ))}
            {overview.stuck.more > 0 && <li className="pl-[26px] text-[14px] text-fail">and {overview.stuck.more} more</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
