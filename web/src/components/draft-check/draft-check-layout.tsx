import type { ReactNode } from "react";

/**
 * Arranges the draft check page's main pieces, following DESIGN.md "Layout".
 *
 * Landscape draft (YouTube video): one column on phones and tablets (money,
 * player, next step, evidence); from 1024px, the player above the next step
 * on the left and the money card above the evidence on the right.
 *
 * Portrait draft (Short or Reel): one column on phones; once the page has
 * 640px of room, the player in a narrow left column with money, evidence and
 * the next step stacked beside it; with 1060px of room, three columns (player,
 * evidence, money) with the next step under the last two.
 *
 * @param vertical - the draft is 9:16
 * @param player - the draft player, or nothing before a draft
 * @param money - the money card
 * @param next - the next-step bar
 * @param evidence - the evidence panel (tablet and up), or nothing
 * @see docs/specs/creator-draft-check-frd.md DC-FR-25, DC-FR-40
 */
export function DraftCheckLayout({
  vertical,
  player,
  money,
  next,
  evidence,
}: {
  vertical: boolean;
  player?: ReactNode;
  money: ReactNode;
  next: ReactNode;
  evidence?: ReactNode;
}) {
  if (vertical) {
    // DOM order is the phone order. Wider layouts are chosen by the space the page has
    // (container queries), not the window, because the rail takes 248px on desktop.
    // Each piece sets its full row and column per size, so no size wipes out another's.
    return (
      <div className="@container mt-5">
        <div
          data-testid="draft-check-layout"
          data-layout="portrait"
          className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 @min-[640px]:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] @min-[640px]:grid-rows-[auto_auto_1fr] @min-[1060px]:grid-cols-[320px_minmax(0,1fr)_minmax(300px,340px)] @min-[1060px]:grid-rows-[auto_1fr]"
        >
          <div className="@min-[640px]:[grid-area:1/2] @min-[1060px]:[grid-area:1/3]">{money}</div>
          {player && <div className="@min-[640px]:[grid-area:1/1/4/2] @min-[1060px]:[grid-area:1/1/3/2]">{player}</div>}
          <div className="@min-[640px]:[grid-area:3/2] @min-[1060px]:[grid-area:2/2/3/4]">{next}</div>
          {evidence && <div className="@min-[640px]:[grid-area:2/2] @min-[1060px]:[grid-area:1/2]">{evidence}</div>}
        </div>
      </div>
    );
  }
  // Below lg: the two column wrappers dissolve (display: contents) and `order` sets the sequence.
  return (
    <div
      data-testid="draft-check-layout"
      data-layout="landscape"
      className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]"
    >
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        {player && <div className="order-2">{player}</div>}
        <div className="order-3">{next}</div>
      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-5">
        <div className="order-1">{money}</div>
        {evidence && <div className="order-4">{evidence}</div>}
      </div>
    </div>
  );
}
