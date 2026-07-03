/**
 * Greedy interval coloring shared by the layout engines: pack 1-D spans into
 * the fewest "lanes" such that no two spans in one lane overlap. Used to keep
 * distinct wires from rendering collinear — parallel rails pack into tracks,
 * stacked drops fan into lanes, channel trunks share a level only when their
 * extents are clear of each other.
 */

export interface LaneSpan<T> {
  readonly lo: number;
  readonly hi: number;
  readonly item: T;
}

/**
 * Assign each span the lowest-numbered lane whose previous span clears it.
 * Spans must arrive pre-sorted (typically by `(lo, hi, tiebreak)`) — the input
 * order is the caller's determinism contract. With `minGap = 0` spans may
 * touch end-to-start in one lane; a positive `minGap` requires strictly more
 * than that much clearance, so two same-lane spans never read as one line.
 */
export function assignLanes<T>(spans: readonly LaneSpan<T>[], minGap = 0): Map<T, number> {
  const laneEnds: number[] = [];
  const lanes = new Map<T, number>();
  for (const span of spans) {
    const fits = (end: number): boolean => (minGap > 0 ? span.lo > end + minGap : span.lo >= end);
    let lane = laneEnds.findIndex(fits);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.hi);
    } else {
      laneEnds[lane] = span.hi;
    }
    lanes.set(span.item, lane);
  }
  return lanes;
}
