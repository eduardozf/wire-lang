import type { ComponentInstance, Net, SchematicModel } from "../model/types.js";
import type { ComponentGeom } from "./geometry.js";
import { componentGeometry } from "./geometry.js";
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

/** A point in pre-transform (main, cross) space. */
interface MC {
  main: number;
  cross: number;
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
  const vertical = model.direction === "top-to-bottom" || model.direction === "bottom-to-top";
  const reversed = model.direction === "right-to-left" || model.direction === "bottom-to-top";

  const ordered = [...model.components].sort((a, b) => a.sourceIndex - b.sourceIndex);
  if (reversed) ordered.reverse();

  // ---- placement ----------------------------------------------------------
  const placed: PlacedComponent[] = [];
  const terminalPoints = new Map<string, MC>();
  let cursor = 0;
  let maxBodyCross = 0;
  let minBodyCross = 0;

  for (const instance of ordered) {
    const geom = componentGeometry(instance);
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
  let bottomNext = maxBodyCross + RAIL_GAP;
  let topNext = minBodyCross - RAIL_GAP;

  const sortedNets = [...model.nets].sort((a, b) => a.sourceIndex - b.sourceIndex);
  for (const net of sortedNets) {
    const points = net.members
      .map((member) => terminalPoints.get(`${member.component}.${member.terminal}`))
      .filter((point): point is MC => point !== undefined);
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
    let railCross: number;
    if (avg < 0) {
      railCross = topNext;
      topNext -= RAIL_GAP;
    } else {
      railCross = bottomNext;
      bottomNext += RAIL_GAP;
    }
    const minMain = Math.min(...points.map((point) => point.main));
    const maxMain = Math.max(...points.map((point) => point.main));

    const segments: { from: MC; to: MC }[] = [];
    const junctions: MC[] = [];
    if (maxMain > minMain) {
      segments.push({
        from: { main: minMain, cross: railCross },
        to: { main: maxMain, cross: railCross },
      });
    }
    for (const point of points) {
      segments.push({ from: point, to: { main: point.main, cross: railCross } });
      if (point.main > minMain && point.main < maxMain) {
        junctions.push({ main: point.main, cross: railCross });
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
  if (!vertical) return side;
  switch (side) {
    case "left":
      return "top";
    case "right":
      return "bottom";
    case "top":
      return "left";
    case "bottom":
      return "right";
  }
}
