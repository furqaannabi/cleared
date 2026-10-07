import { Seal } from "@/components/ui/seal";
import { formatDay, formatMoney } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { LockIcon, ReturnIcon } from "./money-icons";
import { MoneySummary } from "./money-summary";

const STAGES = [
  { id: "held", label: "Held" },
  { id: "confirmed", label: "Confirmed" },
  { id: "captured", label: "Captured" },
  { id: "paid", label: "Paid" },
] as const;

const POST_NAME: Record<Deliverable["platform"], string> = {
  youtube_video: "video",
  youtube_short: "Short",
  instagram_reel: "Reel",
};

/**
 * The money for one deliverable, beside its evidence: the held amount, its
 * PayPal reference and date, the money stage and where it pays out. Shows
 * money only; it has no actions (DC-BR-07).
 *
 * @param deliverable - the deliverable, with its hold
 * @param timeZone - the viewer's timezone for dates
 * @param compact - phones: a one-row summary that expands to the full card
 * @see docs/specs/creator-draft-check-frd.md DC-FR-27, DC-FR-29; DESIGN.md "Money card"
 */
export function MoneyCard({
  deliverable: d,
  timeZone,
  compact = false,
}: {
  deliverable: Deliverable;
  timeZone?: string;
  compact?: boolean;
}) {
  const card = (region: boolean) =>
    d.state === "released" ? <ReleasedCard d={d} timeZone={timeZone} region={region} /> : <HeldCard d={d} timeZone={timeZone} region={region} />;
  // Phones: one row that expands to the full card, so what needs the creator comes first.
  return compact ? <MoneySummary d={d}>{card(false)}</MoneySummary> : card(true);
}

function HeldCard({ d, timeZone, region }: { d: Deliverable; timeZone?: string; region: boolean }) {
  const amount = formatMoney(d.hold.amountMinor, d.hold.currency);
  return (
    <section
      aria-label={region ? "Payment for this deliverable" : undefined}
      className="relative isolate overflow-hidden rounded-lg bg-marigold px-[18px] pt-[18px] pb-[18px] text-marigold-ink shadow-money-card md:px-[22px] md:pt-5"
    >
      <span aria-hidden="true" className="absolute -top-[110px] -right-[90px] -z-10 size-[300px] rounded-full bg-white/25" />
      <Seal fillClassName="fill-marigold-ink" className="absolute top-4 right-[18px] size-[46px] md:size-[50px]">
        <LockIcon className="size-full text-marigold" />
      </Seal>
      <p className="text-chip font-bold text-marigold-ink-2">Held in PayPal for this {POST_NAME[d.platform]}</p>
      <p className="mt-1.5 font-head text-amount-phone font-extrabold tracking-[-0.01em] md:text-amount">{amount}</p>
      <p className="mt-1.5 text-chip font-semibold text-marigold-ink-2">
        Ref {d.hold.reference} · held {formatDay(d.hold.heldAt, timeZone)}
      </p>
      <ol aria-label="Money stage" className="mt-4 grid grid-cols-4 gap-1.5">
        {STAGES.map((stage) => {
          const current = stage.id === d.hold.stage;
          return (
            <li
              key={stage.id}
              aria-current={current ? "step" : undefined}
              className={`rounded-pill py-1.5 text-center text-label font-bold ${current ? "bg-marigold-ink text-marigold" : "bg-marigold-chip text-marigold-ink-2"}`}
            >
              {stage.label}
            </li>
          );
        })}
      </ol>
      <div className="mt-3.5 flex justify-between gap-3 border-t border-marigold-ink/15 pt-3 text-chip font-semibold text-marigold-ink-2">
        <span>Pays out to</span>
        <b className="min-w-0 truncate font-extrabold text-marigold-ink">{d.payoutEmail}</b>
      </div>
    </section>
  );
}

// DC-FR-29: the money no longer moves towards the creator, so the card drops
// its marigold and its lift (DESIGN.md "Money card", Released).
function ReleasedCard({ d, timeZone, region }: { d: Deliverable; timeZone?: string; region: boolean }) {
  const amount = formatMoney(d.hold.amountMinor, d.hold.currency);
  const reason = d.releaseReason === "deadline" ? "deadline passed" : "deal cancelled";
  const when = d.releasedAt ? `Released ${formatDay(d.releasedAt, timeZone)}` : "Released";
  return (
    <section
      aria-label={region ? "Payment for this deliverable" : undefined}
      className="relative isolate overflow-hidden rounded-lg border border-latte-line bg-latte px-[18px] pt-[18px] pb-[18px] text-ink md:px-[22px] md:pt-5"
    >
      <span aria-hidden="true" className="absolute -top-[110px] -right-[90px] -z-10 size-[300px] rounded-full bg-white/50" />
      <Seal fillClassName="fill-latte-line" className="absolute top-4 right-[18px] size-[46px] md:size-[50px]">
        <ReturnIcon className="size-full text-espresso" />
      </Seal>
      <p className="text-chip font-bold text-ink-3">Released to {d.brandName}</p>
      <p className="mt-1.5 font-head text-amount-phone font-extrabold tracking-[-0.01em] text-ink-2 md:text-amount">
        {amount}
      </p>
      <p className="mt-1.5 text-chip font-semibold text-ink-3">
        {when} · {reason}
        {d.releaseReference ? ` · Ref ${d.releaseReference}` : ""}
      </p>
      <ol aria-label="Money stage" className="mt-4 grid grid-cols-1">
        <li aria-current="step" className="rounded-pill bg-latte-line py-1.5 text-center text-label font-bold text-espresso-deep">
          Released
        </li>
      </ol>
      <div className="mt-3.5 flex justify-between gap-3 border-t border-latte-line pt-3 text-chip font-semibold text-ink-3">
        <span>Went back to</span>
        <b className="min-w-0 truncate font-extrabold text-ink-2">{d.brandName}’s PayPal</b>
      </div>
    </section>
  );
}
