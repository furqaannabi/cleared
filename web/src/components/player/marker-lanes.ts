/**
 * Which row each timeline marker sits on (DC-FR-24): 0 on the timeline, 1
 * lifted to a second row, so markers closer than one tap target don't cover
 * each other. Greedy, in time order: the timeline if there is room, else the
 * second row if there is room there, else the timeline (two rows is the cap).
 *
 * @param xs - each marker's position along the timeline, in px, in time order
 * @param gap - the smallest distance between two markers on one row (the 44px tap target)
 * @returns the row for each marker, in the same order
 * @see docs/specs/creator-draft-check-frd.md DC-FR-24; DESIGN.md "Evidence timeline"
 */
export function markerLanes(xs: number[], gap: number): (0 | 1)[] {
  const last = [-Infinity, -Infinity];
  return xs.map((x) => {
    const lane: 0 | 1 = x - last[0] >= gap ? 0 : x - last[1] >= gap ? 1 : 0;
    last[lane] = x;
    return lane;
  });
}
