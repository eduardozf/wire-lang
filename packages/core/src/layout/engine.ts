import type { ComponentInstance, Net, SchematicModel } from "../model/types.js";
import { layoutBusRail } from "./bus-rail.js";
import type { ComponentGeom } from "./geometry.js";
import { componentGeometry, rotateGeometry, rotateSide90 } from "./geometry.js";
import type {
  LayoutComponent,
  LayoutLabel,
  LayoutModel,
  LayoutWire,
  Point,
  Segment,
  TerminalSide,
} from "./types.js";

const MARGIN = 36;
const GAP_MAIN = 52;
const RAIL_GAP = 26;
const STUB = 18;
/** Sideways step between the vertical drops of two terminals that share a `main`. */
const LANE_GAP = 12;

/** A point in pre-transform (main, cross) space. */
interface MC {
  main: number;
  cross: number;
}

/** A net member's terminal, tagged with its body center so drops can fan away from it. */
interface DropPoint extends MC {
  centerMain: number;
}

/**
 * The vertical run from a terminal down to its net's rail. `lane` is the
 * sideways offset (in `main` units) applied so drops that share a `main`
 * coordinate do not stack on a single line.
 */
interface Drop {
  main: number;
  cross: number;
  railCross: number;
  centerMain: number;
  lane: number;
}

/** A multi-terminal net awaiting rail-track assignment and segment emission. */
interface PendingNet {
  net: Net;
  side: "top" | "bottom";
  railCross: number;
  minMain: number;
  maxMain: number;
  drops: Drop[];
}

interface PlacedComponent {
  instance: ComponentInstance;
  geom: ComponentGeom;
  mainStart: number;
  centerMain: number;
}

interface RawWire {
  net: string;
  anonymous: boolean;
  style: "wire" | "label";
  segments: { from: MC; to: MC }[];
  junctions: MC[];
}

interface RawLabel {
  text: string;
  point: MC;
  anchor: "start" | "middle" | "end";
  kind: "annotation" | "net-label";
}

export function layout(model: SchematicModel): LayoutModel {
  if (model.layout === "bus-rail") return layoutBusRail(model);

  const vertical = model.direction === "top-to-bottom" || model.direction === "bottom-to-top";
  const reversed = model.direction === "right-to-left" || model.direction === "bottom-to-top";

  // A component's body runs along the flow's `main` axis by default, so it reads
  // as horizontal in a horizontal flow and vertical in a vertical one. An
  // explicit `orientation` that runs against that natural axis rotates the part.
  const flowOrientation = vertical ? "vertical" : "horizontal";

  const ordered = [...model.components].sort((a, b) => a.sourceIndex - b.sourceIndex);
  if (reversed) ordered.reverse();

  // ---- placement ----------------------------------------------------------
  const placed: PlacedComponent[] = [];
  const terminalPoints = new Map<string, MC>();
  let cursor = 0;
  let maxBodyCross = 0;
  let minBodyCross = 0;

  for (const instance of ordered) {
    const base = componentGeometry(instance);
    const geom =
      instance.orientation && instance.orientation !== flowOrientation
        ? rotateGeometry(base)
        : base;
    const mainStart = cursor;
    for (const terminal of geom.terminals) {
      terminalPoints.set(`${instance.id}.${terminal.name}`, {
        main: mainStart + terminal.main,
        cross: terminal.cross,
      });
    }
    maxBodyCross = Math.max(maxBodyCross, geom.crossSpan / 2);
    minBodyCross = Math.min(minBodyCross, -geom.crossSpan / 2);
    placed.push({ instance, geom, mainStart, centerMain: mainStart + geom.mainSpan / 2 });
    cursor += geom.mainSpan + GAP_MAIN;
  }

  // ---- routing ------------------------------------------------------------
  const wires: RawWire[] = [];
  const labels: RawLabel[] = [];
  const railInfo = new Map<string, { railCross: number; minMain: number; maxMain: number }>();

  const centerByComponent = new Map(placed.map((entry) => [entry.instance.id, entry.centerMain]));

  // Multi-terminal nets route through horizontal rails, built in phases:
  //   1. pick each net's side (top/bottom) and collect its terminal drops;
  //   2. fan drops that share a `main` into lanes so distinct nets never render
  //      collinear (see assignDropLanes) — pins on one IC edge would otherwise
  //      stack their vertical drops on a single line and read as one wire;
  //   3. pack the rails into shared cross-level tracks so horizontally-disjoint
  //      nets share a level instead of each claiming its own (see
  //      assignRailTracks) — this is what keeps a dense schematic from stacking
  //      a separate full-width rail per net;
  //   4. emit segments.
  const pendingNets: PendingNet[] = [];
  const allDrops: Drop[] = [];

  // Provisional rail levels used only while assigning drop lanes; the final
  // tracks are packed afterward. Deeper tracks only lengthen drops away from the
  // body, so a lane that is conflict-free here stays conflict-free at any track.
  const topProvisional = minBodyCross - RAIL_GAP;
  const bottomProvisional = maxBodyCross + RAIL_GAP;

  const sortedNets = [...model.nets].sort((a, b) => a.sourceIndex - b.sourceIndex);
  for (const net of sortedNets) {
    const points = net.members
      .map((member): DropPoint | undefined => {
        const point = terminalPoints.get(`${member.component}.${member.terminal}`);
        if (!point) return undefined;
        return { ...point, centerMain: centerByComponent.get(member.component) ?? point.main };
      })
      .filter((point): point is DropPoint => point !== undefined);
    if (points.length === 0) continue;

    if (net.style === "label") {
      routeLabelNet(net, points, wires, labels);
      continue;
    }

    if (points.length === 1) {
      const only = points[0]!;
      const end: MC = { main: only.main, cross: only.cross + STUB };
      wires.push({
        net: net.name,
        anonymous: net.anonymous,
        style: "wire",
        segments: [{ from: only, to: end }],
        junctions: [],
      });
      continue;
    }

    const avg = points.reduce((sum, point) => sum + point.cross, 0) / points.length;
    const side: "top" | "bottom" = avg < 0 ? "top" : "bottom";
    const railCross = side === "top" ? topProvisional : bottomProvisional;
    const drops: Drop[] = points.map((point) => ({
      main: point.main,
      cross: point.cross,
      railCross,
      centerMain: point.centerMain,
      lane: 0,
    }));
    pendingNets.push({ net, side, railCross, minMain: 0, maxMain: 0, drops });
    allDrops.push(...drops);
  }

  assignDropLanes(allDrops);

  // With lanes fixed, record each rail's true main extent, then pack the rails
  // into shared tracks per side so unrelated nets stop stacking up the margins.
  for (const pending of pendingNets) {
    const mains = pending.drops.map((drop) => drop.main + drop.lane);
    pending.minMain = Math.min(...mains);
    pending.maxMain = Math.max(...mains);
  }
  assignRailTracks(pendingNets, minBodyCross, maxBodyCross);

  for (const { net, railCross, minMain, maxMain, drops } of pendingNets) {
    for (const drop of drops) drop.railCross = railCross;
    const laneMain = (drop: Drop) => drop.main + drop.lane;

    const segments: { from: MC; to: MC }[] = [];
    const junctions: MC[] = [];
    if (maxMain > minMain) {
      segments.push({
        from: { main: minMain, cross: railCross },
        to: { main: maxMain, cross: railCross },
      });
    }
    for (const drop of drops) {
      const lm = laneMain(drop);
      // Step sideways into the assigned lane before running down to the rail.
      if (drop.lane !== 0) {
        segments.push({
          from: { main: drop.main, cross: drop.cross },
          to: { main: lm, cross: drop.cross },
        });
      }
      segments.push({ from: { main: lm, cross: drop.cross }, to: { main: lm, cross: railCross } });
      if (lm > minMain && lm < maxMain) {
        junctions.push({ main: lm, cross: railCross });
      }
    }
    wires.push({ net: net.name, anonymous: net.anonymous, style: "wire", segments, junctions });
    railInfo.set(net.name, { railCross, minMain, maxMain });
  }

  // ---- annotations --------------------------------------------------------
  const byId = new Map(placed.map((entry) => [entry.instance.id, entry]));
  for (const annotation of model.annotations) {
    if (annotation.targetKind === "component") {
      const entry = byId.get(annotation.target);
      if (!entry) continue;
      // Sit clear of the component's stacked default labels.
      const labelCount = entry.instance.labels.filter((label) => label !== "").length;
      labels.push({
        text: annotation.text,
        point: {
          main: entry.centerMain,
          cross: -entry.geom.crossSpan / 2 - 16 - labelCount * 13,
        },
        anchor: "middle",
        kind: "annotation",
      });
    } else {
      const rail = railInfo.get(annotation.target);
      if (rail) {
        labels.push({
          text: annotation.text,
          point: { main: (rail.minMain + rail.maxMain) / 2, cross: rail.railCross + 12 },
          anchor: "middle",
          kind: "annotation",
        });
      } else {
        const net = model.nets.find((candidate) => candidate.name === annotation.target);
        const first = net?.members[0];
        const point = first
          ? terminalPoints.get(`${first.component}.${first.terminal}`)
          : undefined;
        if (point) {
          labels.push({
            text: annotation.text,
            point: { main: point.main, cross: point.cross - 12 },
            anchor: "middle",
            kind: "annotation",
          });
        }
      }
    }
  }

  // ---- normalize + transform ---------------------------------------------
  const allPoints: MC[] = [];
  for (const entry of placed) {
    allPoints.push({ main: entry.mainStart, cross: -entry.geom.crossSpan / 2 });
    allPoints.push({
      main: entry.mainStart + entry.geom.mainSpan,
      cross: entry.geom.crossSpan / 2,
    });
  }
  for (const wire of wires) {
    for (const segment of wire.segments) {
      allPoints.push(segment.from, segment.to);
    }
  }
  for (const label of labels) allPoints.push(label.point);
  if (allPoints.length === 0) allPoints.push({ main: 0, cross: 0 });

  const minMainAll = Math.min(...allPoints.map((point) => point.main));
  const maxMainAll = Math.max(...allPoints.map((point) => point.main));
  const minCrossAll = Math.min(...allPoints.map((point) => point.cross));
  const maxCrossAll = Math.max(...allPoints.map((point) => point.cross));

  const tf = (point: MC): Point => {
    const m = point.main - minMainAll + MARGIN;
    const c = point.cross - minCrossAll + MARGIN;
    return vertical ? { x: c, y: m } : { x: m, y: c };
  };

  const contentMain = maxMainAll - minMainAll;
  const contentCross = maxCrossAll - minCrossAll;
  const size = vertical
    ? { width: contentCross + 2 * MARGIN, height: contentMain + 2 * MARGIN }
    : { width: contentMain + 2 * MARGIN, height: contentCross + 2 * MARGIN };

  const layoutComponents: LayoutComponent[] = placed.map((entry) => {
    const corners = [
      tf({ main: entry.mainStart, cross: -entry.geom.crossSpan / 2 }),
      tf({ main: entry.mainStart + entry.geom.mainSpan, cross: entry.geom.crossSpan / 2 }),
    ];
    const minX = Math.min(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const maxY = Math.max(...corners.map((corner) => corner.y));
    const center = tf({ main: entry.centerMain, cross: 0 });
    const terminals = entry.geom.terminals.map((terminal) => {
      const point = tf({ main: entry.mainStart + terminal.main, cross: terminal.cross });
      // IC pins carry an explicit local-frame side; rotate it into the flow's
      // visual frame. Other symbols derive the side from the point's position.
      const side = terminal.side ? rotateSide(terminal.side, vertical) : sideOf(point, center);
      return { name: terminal.name, point, side, number: terminal.number };
    });
    return {
      id: entry.instance.id,
      typeName: entry.instance.typeName,
      symbol: entry.instance.symbol,
      position: { x: minX, y: minY },
      size: { width: maxX - minX, height: maxY - minY },
      center,
      terminals,
      labels: entry.instance.labels,
      roleMappings: entry.instance.roleMappings,
      properties: entry.instance.properties,
    };
  });

  const layoutWires: LayoutWire[] = wires.map((wire) => ({
    net: wire.net,
    anonymous: wire.anonymous,
    style: wire.style,
    segments: wire.segments.map(
      (segment): Segment => ({ from: tf(segment.from), to: tf(segment.to) }),
    ),
    junctions: wire.junctions.map((junction) => tf(junction)),
  }));

  const layoutLabels: LayoutLabel[] = labels.map((label) => ({
    text: label.text,
    point: tf(label.point),
    anchor: label.anchor,
    kind: label.kind,
  }));

  const noConnects: Point[] = [];
  for (const noConnect of model.noConnects) {
    const point = terminalPoints.get(`${noConnect.component}.${noConnect.terminal}`);
    if (point) noConnects.push(tf(point));
  }

  return {
    size,
    components: layoutComponents,
    wires: layoutWires,
    labels: layoutLabels,
    noConnects,
    crossings: model.crossings,
    title: model.title,
    description: model.description,
  };
}

/**
 * Spread drops that share a `main` coordinate into separate lanes so their
 * vertical runs never render collinear. Drops are grouped by `main`; within a
 * group, greedy interval coloring (by the cross span each drop covers between
 * its terminal and rail) keeps the lane count minimal and leaves
 * non-overlapping drops in lane 0. Lanes fan away from the owning body, so the
 * stepped runs never cut back through the component.
 */
function assignDropLanes(drops: Drop[]): void {
  const byMain = new Map<number, Drop[]>();
  for (const drop of drops) {
    const key = Math.round(drop.main);
    const group = byMain.get(key);
    if (group) group.push(drop);
    else byMain.set(key, [drop]);
  }

  for (const group of byMain.values()) {
    if (group.length < 2) continue;
    const spans = group
      .map((drop) => ({
        drop,
        lo: Math.min(drop.cross, drop.railCross),
        hi: Math.max(drop.cross, drop.railCross),
      }))
      .sort((a, b) => a.lo - b.lo || a.hi - b.hi);

    // `laneEnds[i]` is the far end of the last span placed in lane `i`; a lane is
    // reusable once its previous span clears the next span's start.
    const laneEnds: number[] = [];
    for (const span of spans) {
      let lane = laneEnds.findIndex((end) => end <= span.lo);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(span.hi);
      } else {
        laneEnds[lane] = span.hi;
      }
      const dir = span.drop.main < span.drop.centerMain ? -1 : 1;
      span.drop.lane = lane * LANE_GAP * dir;
    }
  }
}

/**
 * Pack rails into shared cross-level tracks per side. Two rails whose main
 * extents are clear of each other can sit on the same track instead of each
 * stepping further from the body; greedy interval coloring (rails sorted by
 * start) minimises the track count, so a dense schematic no longer stacks one
 * full-width rail per net. Track 0 is nearest the bodies; deeper tracks step out
 * by `RAIL_GAP`. A `RAIL_GAP` gap is required between same-track rails so two
 * nets never read as one continuous wire meeting end to end.
 */
function assignRailTracks(nets: PendingNet[], minBodyCross: number, maxBodyCross: number): void {
  for (const side of ["top", "bottom"] as const) {
    const group = nets
      .filter((pending) => pending.side === side)
      .sort(
        (a, b) =>
          a.minMain - b.minMain || a.maxMain - b.maxMain || a.net.sourceIndex - b.net.sourceIndex,
      );

    // `trackEnds[i]` is the furthest main reached by the last rail on track `i`;
    // a track is reusable once its previous rail clears the next rail's start.
    const trackEnds: number[] = [];
    for (const pending of group) {
      let track = trackEnds.findIndex((end) => pending.minMain > end + RAIL_GAP);
      if (track === -1) {
        track = trackEnds.length;
        trackEnds.push(pending.maxMain);
      } else {
        trackEnds[track] = pending.maxMain;
      }
      pending.railCross =
        side === "top"
          ? minBodyCross - RAIL_GAP * (track + 1)
          : maxBodyCross + RAIL_GAP * (track + 1);
    }
  }
}

function routeLabelNet(net: Net, points: MC[], wires: RawWire[], labels: RawLabel[]): void {
  const segments: { from: MC; to: MC }[] = [];
  for (const point of points) {
    const down = point.cross >= 0;
    const end: MC = { main: point.main, cross: point.cross + (down ? STUB : -STUB) };
    segments.push({ from: point, to: end });
    labels.push({
      text: net.name,
      point: { main: end.main, cross: end.cross + (down ? 10 : -4) },
      anchor: "middle",
      kind: "net-label",
    });
  }
  wires.push({ net: net.name, anonymous: net.anonymous, style: "label", segments, junctions: [] });
}

function sideOf(point: Point, center: Point): TerminalSide {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "top" : "bottom";
}

/**
 * Map a component's local-frame side onto its rendered side. A vertical flow
 * swaps the main and cross axes, so local left/right become top/bottom and local
 * top/bottom become left/right. Horizontal flows keep the local side as-is.
 */
function rotateSide(side: TerminalSide, vertical: boolean): TerminalSide {
  return vertical ? rotateSide90(side) : side;
}
