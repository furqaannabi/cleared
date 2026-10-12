/**
 * A name shown beside a folded rail's icon on hover and keyboard focus. Seen
 * only, so screen readers hear the item's own name once; its parent carries
 * `group relative`.
 *
 * @param children - the name
 * @see docs/specs/creator-draft-check-frd.md DC-FR-55
 */
export function RailTip({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-full z-30 ml-3 -translate-y-1/2 rounded-[8px] bg-ink px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap text-white opacity-0 shadow-[0_6px_18px_rgb(0_0_0/0.25)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
    >
      {children}
    </span>
  );
}
