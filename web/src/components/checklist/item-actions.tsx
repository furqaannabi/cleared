import type { ItemView } from "@/lib/deliverable/deliverable-view";

/** Whether an item has anything for ItemActions to show, so callers can skip its frame. */
export function hasItemActions(item: ItemView): boolean {
  return item.action !== null || item.status === "accepted_by_brand";
}

/**
 * What the creator can do about one item, and what the brand has said about
 * it: ask the brand to accept an Unsure item, withdraw an ask, or that the
 * brand accepted it. A declined item's note is BrandNote, above the evidence. Used in the evidence
 * panel (tablet and up) and inside the expanded item card (phones).
 *
 * @param item - the item, with its action from the deliverable view
 * @param brandName - the deal's brand
 * @param onAsk - asks the brand to accept this item
 * @param onWithdraw - withdraws the ask
 * @param pending - a request for this item is in flight; buttons are disabled
 * @param problem - a plain-language problem from the last attempt, or null
 * @see docs/specs/creator-draft-check-frd.md DC-FR-14 to DC-FR-18; docs/decisions/2026-10-06-creator-asks-brand-to-accept-unsure.md
 */
export function ItemActions({
  item,
  brandName,
  onAsk,
  onWithdraw,
  pending,
  problem,
}: {
  item: ItemView;
  brandName: string;
  onAsk: () => void;
  onWithdraw: () => void;
  pending: boolean;
  problem: string | null;
}) {
  if (!hasItemActions(item)) return null;
  const accepted = item.status === "accepted_by_brand";

  return (
    <div className="flex flex-col gap-2.5">
      {accepted && (
        <p className="text-[14px] font-semibold text-ink-2">
          {brandName} accepted this moment. It counts as passed for this draft.
        </p>
      )}
      {/* One slot for Ask and Withdraw, so the same button keeps focus when one becomes the other. */}
      {item.action && (
        <Action
          label={item.action === "ask" ? `Ask ${brandName} to accept` : "Withdraw"}
          onPress={item.action === "ask" ? onAsk : onWithdraw}
          pending={pending}
        >
          {item.action === "ask"
            ? `${brandName} sees this moment and its evidence. You can still upload a fix.`
            : `You asked ${item.asked ?? "earlier"}. It stays here until ${brandName} answers; it never clears on a timer.`}
        </Action>
      )}
      {problem && (
        <p role="alert" className="text-meta font-semibold text-fail">
          {problem}
        </p>
      )}
    </div>
  );
}

function Action({
  label,
  onPress,
  pending,
  children,
}: {
  label: string;
  onPress: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        // aria-disabled, not disabled: a disabled button would drop keyboard focus mid-request.
        onClick={() => !pending && onPress()}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        className="inline-flex min-h-11 items-center rounded-pill border border-latte-line bg-surface px-[18px] text-body-strong font-bold text-espresso transition-colors hover:bg-latte-wash active:translate-y-px aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        {label}
      </button>
      <p className="text-chip text-ink-3">{children}</p>
    </div>
  );
}
