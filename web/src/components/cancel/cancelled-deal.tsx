import { ReturnIcon } from "@/components/money/money-icons";
import { Seal } from "@/components/ui/seal";
import { formatDay } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";

type Cancelled = NonNullable<Deliverable["cancelled"]>;

/**
 * A deal whose every post is cancelled: latte, no lift, the return seal; who
 * cancelled, when, and the other side's note. "Cancelled before it was held"
 * when nothing was held.
 *
 * @param cancels - each post's cancel, with whether it was held
 * @see docs/specs/cancel-frd.md CN-FR-10, CN-FR-11, CN-FR-14, CN-FR-15; design/cancel/after.html
 */
export function CancelledDeal({
  cancels,
  side,
  brandName,
  creatorName,
  timeZone,
}: {
  cancels: { cancelled: Cancelled; held: boolean }[];
  side: "creator" | "brand";
  brandName: string;
  creatorName: string;
  timeZone?: string;
}) {
  const last = [...cancels].sort((a, b) => Date.parse(b.cancelled.at) - Date.parse(a.cancelled.at))[0];
  if (!last) return null;
  const c = last.cancelled;
  const mine = c.by === side;
  const who = mine ? "You" : c.by === "brand" ? brandName : creatorName;
  const anyHeld = cancels.some((x) => x.held);
  return (
    <section aria-labelledby="cancelled-deal" className="relative mt-6 grid gap-1.5 overflow-hidden rounded-lg border border-latte-line bg-latte p-[18px] pr-20">
      <Seal fillClassName="fill-latte-line" className="absolute top-4 right-[18px] size-[46px]">
        <ReturnIcon className="size-full text-espresso" />
      </Seal>
      <h2 id="cancelled-deal" className="font-head text-[22px] leading-tight font-bold text-ink-2">
        {anyHeld ? "Deal cancelled" : "Cancelled before it was held"}
      </h2>
      <p className="text-[14px] text-ink-2">
        {anyHeld ? `The held money went back to ${side === "brand" ? "you" : brandName}.` : "Nothing was taken."} {who} cancelled this deal on {formatDay(c.at, timeZone)}.
      </p>
      {!mine && c.note && <p className="rounded-md bg-latte-wash px-3 py-2.5 text-[14px] whitespace-pre-wrap text-ink-2">“{c.note}”</p>}
    </section>
  );
}
