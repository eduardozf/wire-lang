import type { Point, Segment } from "./types.js";

const EPS = 0.01;
const OUTER_TRACK_GAP = 12;
const INTERNAL_TRACK_GAP = 16;

/** Minimum corridor width that keeps every candidate route track legible. */
export function requiredFacingChannelWidth(connectionCount: number): number {
  if (connectionCount <= 0) return 0;
  const internalCount = Math.max(4, connectionCount + 1);
  return (internalCount + 1) * INTERNAL_TRACK_GAP;
}

export interface FacingConnection<T> {
  readonly key: T;
  readonly sourceIndex: number;
  readonly left: Point;
  readonly right: Point;
}

interface Candidate {
  readonly segments: Segment[];
  readonly crossings: number;
  readonly bends: number;
  readonly length: number;
  readonly order: number;
}

/**
 * Route two-terminal connections between two facing component edges.
 *
 * Simple connections use an H-V-H path inside the empty corridor. If fixed
 * pin order would make that path share a segment or touch another route at a
 * corner, the router tries an H-V-H-V-H dogleg above or below the pin field.
 * Only proper perpendicular crossings are allowed between distinct nets.
 */
export function routeFacingChannel<T>(
  connections: readonly FacingConnection<T>[],
): Map<T, Segment[]> | null {
  if (connections.length === 0) return new Map();

  const ordered = [...connections].sort(
    (a, b) =>
      a.left.y - b.left.y ||
      a.sourceIndex - b.sourceIndex ||
      String(a.key).localeCompare(String(b.key)),
  );
  const leftX = ordered[0]!.left.x;
  const rightX = ordered[0]!.right.x;
  if (rightX - leftX <= EPS) return null;

  const internalCount = Math.max(4, connections.length + 1);
  const internalXs = Array.from(
    { length: internalCount },
    (_, index) => leftX + ((rightX - leftX) * (index + 1)) / (internalCount + 1),
  );

  const endpointYs = ordered.flatMap((connection) => [connection.left.y, connection.right.y]);
  const minY = Math.min(...endpointYs);
  const maxY = Math.max(...endpointYs);
  const outerYs: number[] = [];
  for (let index = 1; index <= connections.length + 1; index++) {
    outerYs.push(minY - index * OUTER_TRACK_GAP, maxY + index * OUTER_TRACK_GAP);
  }

  const result = new Map<T, Segment[]>();
  const occupied: Segment[] = [];

  for (const [connectionIndex, connection] of ordered.entries()) {
    const candidates: Candidate[] = [];
    let order = 0;

    if (Math.abs(connection.left.y - connection.right.y) < EPS) {
      addCandidate(
        candidates,
        [{ from: connection.left, to: connection.right }],
        occupied,
        order++,
      );
    } else {
      const next = ordered[connectionIndex + 1];
      const availableXs = internalXs.filter((x) => !verticalTrackOccupied(x, occupied));
      const candidateXs =
        next && connection.right.y > next.right.y && availableXs.length >= 2
          ? [availableXs[1]!, availableXs[0]!, ...availableXs.slice(2)]
          : availableXs;
      for (const x of candidateXs) {
        addCandidate(
          candidates,
          compactSegments([
            { from: connection.left, to: { x, y: connection.left.y } },
            { from: { x, y: connection.left.y }, to: { x, y: connection.right.y } },
            { from: { x, y: connection.right.y }, to: connection.right },
          ]),
          occupied,
          order++,
        );
      }
    }

    if (!candidates.some((candidate) => candidate.crossings === 0)) {
      const doglegYs = [...outerYs].sort(
        (a, b) => verticalDistance(connection, a) - verticalDistance(connection, b) || a - b,
      );
      doglegs: for (const y of doglegYs) {
        for (const leftLane of [...internalXs].sort((a, b) => a - b)) {
          for (const rightLane of [...internalXs].sort((a, b) => a - b)) {
            if (rightLane - leftLane <= EPS) continue;
            const previousCount = candidates.length;
            addCandidate(
              candidates,
              compactSegments([
                { from: connection.left, to: { x: leftLane, y: connection.left.y } },
                { from: { x: leftLane, y: connection.left.y }, to: { x: leftLane, y } },
                { from: { x: leftLane, y }, to: { x: rightLane, y } },
                { from: { x: rightLane, y }, to: { x: rightLane, y: connection.right.y } },
                { from: { x: rightLane, y: connection.right.y }, to: connection.right },
              ]),
              occupied,
              order++,
            );
            const added = candidates.length > previousCount ? candidates.at(-1) : undefined;
            if (added?.crossings === 0) break doglegs;
          }
        }
      }
    }

    candidates.sort(
      (a, b) =>
        a.crossings - b.crossings || a.bends - b.bends || a.length - b.length || a.order - b.order,
    );
    const chosen = candidates[0];
    if (!chosen) return null;
    result.set(connection.key, chosen.segments);
    occupied.push(...chosen.segments);
  }

  return result;
}

function verticalDistance<T>(connection: FacingConnection<T>, y: number): number {
  return Math.abs(connection.left.y - y) + Math.abs(connection.right.y - y);
}

function addCandidate(
  candidates: Candidate[],
  segments: Segment[],
  occupied: readonly Segment[],
  order: number,
): void {
  let crossings = 0;
  for (const segment of segments) {
    for (const other of occupied) {
      if (sameVerticalTrack(segment, other)) return;
      const relation = segmentRelation(segment, other);
      if (relation === "conflict") return;
      if (relation === "crossing") crossings += 1;
    }
  }
  candidates.push({
    segments,
    crossings,
    bends: Math.max(0, segments.length - 1),
    length: segments.reduce(
      (total, segment) =>
        total + Math.abs(segment.from.x - segment.to.x) + Math.abs(segment.from.y - segment.to.y),
      0,
    ),
    order,
  });
}

function verticalTrackOccupied(x: number, occupied: readonly Segment[]): boolean {
  return occupied.some(
    (segment) =>
      Math.abs(segment.from.x - segment.to.x) < EPS && Math.abs(segment.from.x - x) < EPS,
  );
}

function sameVerticalTrack(a: Segment, b: Segment): boolean {
  const aVertical = Math.abs(a.from.x - a.to.x) < EPS;
  const bVertical = Math.abs(b.from.x - b.to.x) < EPS;
  return aVertical && bVertical && Math.abs(a.from.x - b.from.x) < EPS;
}

function compactSegments(segments: readonly Segment[]): Segment[] {
  return segments.filter(
    (segment) =>
      Math.abs(segment.from.x - segment.to.x) > EPS ||
      Math.abs(segment.from.y - segment.to.y) > EPS,
  );
}

function segmentRelation(a: Segment, b: Segment): "clear" | "crossing" | "conflict" {
  const aHorizontal = Math.abs(a.from.y - a.to.y) < EPS;
  const bHorizontal = Math.abs(b.from.y - b.to.y) < EPS;
  const aVertical = Math.abs(a.from.x - a.to.x) < EPS;
  const bVertical = Math.abs(b.from.x - b.to.x) < EPS;

  if (aHorizontal && bHorizontal && Math.abs(a.from.y - b.from.y) < EPS) {
    return overlap(a.from.x, a.to.x, b.from.x, b.to.x) >= -EPS ? "conflict" : "clear";
  }
  if (aVertical && bVertical && Math.abs(a.from.x - b.from.x) < EPS) {
    return overlap(a.from.y, a.to.y, b.from.y, b.to.y) >= -EPS ? "conflict" : "clear";
  }

  if ((aHorizontal && bVertical) || (aVertical && bHorizontal)) {
    const horizontal = aHorizontal ? a : b;
    const vertical = aVertical ? a : b;
    const x = vertical.from.x;
    const y = horizontal.from.y;
    if (
      !between(x, horizontal.from.x, horizontal.to.x) ||
      !between(y, vertical.from.y, vertical.to.y)
    ) {
      return "clear";
    }
    const interiorHorizontal = strictlyBetween(x, horizontal.from.x, horizontal.to.x);
    const interiorVertical = strictlyBetween(y, vertical.from.y, vertical.to.y);
    return interiorHorizontal && interiorVertical ? "crossing" : "conflict";
  }

  return "clear";
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return (
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1))
  );
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) - EPS && value <= Math.max(a, b) + EPS;
}

function strictlyBetween(value: number, a: number, b: number): boolean {
  return value > Math.min(a, b) + EPS && value < Math.max(a, b) - EPS;
}
