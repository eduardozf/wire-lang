import type { LayoutModel, Segment } from "@wire-lang/core";

const EPS = 0.01;

/** Length of the 1-D overlap of `[a0,a1]` and `[b0,b1]` (negative if disjoint). */
function overlapLength(a0: number, a1: number, b0: number, b1: number): number {
  return (
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1))
  );
}

/**
 * Pairs of segments from *different* nets that render exactly collinear and
 * overlapping — two distinct connections drawn as one line.
 */
export function collinearOverlaps(model: LayoutModel): { a: string; b: string; length: number }[] {
  const segs: { net: string; segment: Segment }[] = [];
  for (const wire of model.wires) {
    for (const segment of wire.segments) segs.push({ net: wire.net, segment });
  }
  const hits: { a: string; b: string; length: number }[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]!;
      const b = segs[j]!;
      if (a.net === b.net) continue;
      const sa = a.segment;
      const sb = b.segment;
      const aVert = Math.abs(sa.from.x - sa.to.x) < EPS;
      const bVert = Math.abs(sb.from.x - sb.to.x) < EPS;
      const aHoriz = Math.abs(sa.from.y - sa.to.y) < EPS;
      const bHoriz = Math.abs(sb.from.y - sb.to.y) < EPS;
      let length = 0;
      if (aVert && bVert && Math.abs(sa.from.x - sb.from.x) < EPS) {
        length = overlapLength(sa.from.y, sa.to.y, sb.from.y, sb.to.y);
      } else if (aHoriz && bHoriz && Math.abs(sa.from.y - sb.from.y) < EPS) {
        length = overlapLength(sa.from.x, sa.to.x, sb.from.x, sb.to.x);
      }
      if (length > EPS) hits.push({ a: a.net, b: b.net, length });
    }
  }
  return hits;
}
