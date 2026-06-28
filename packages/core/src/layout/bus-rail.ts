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

// ---- tunables --------------------------------------------------------------
const MARGIN = 44;
const COL_GAP = 150; // horizontal gap between component columns (room for trunks)
const RAIL_MARGIN = 64; // distance from content to each power rail
const RAIL_PAD = 28; // rail overhang past the outermost tap
const CONTROL_GAP = 70; // vertical gap between the main row and the control band
const BUS_LEAD = 18; // horizontal lead from a pin before its tap into a bus
const BUS_APEX_REACH = 24; // horizontal distance from the knee line to the shared entry point
const EDGE_STUB = 10; // stub out of a top/bottom (module) pin before it turns toward a rail
const SIGNAL_CHANNEL = 26; // first signal channel offset below the component row
const BUS_PAIR_SEPARATOR = "::";

// ---- net-family palette ----------------------------------------------------
const COLOR = {
  supply: "#c0392b",
  ground: "#1f2937",
  control: "#1d4ed8",
  signal: "#475569",
} as const;
/** Distinct trunks cycle through these so adjacent buses never share a color. */
const BUS_PALETTE = ["#15803d", "#b45309", "#7c3aed", "#0e7490", "#be185d"];

// ---- stroke-width tiers ----------------------------------------------------
const WIDTH = { signal: 1.4, tap: 1.8, rail: 3, bus: 4.5 } as const;

const SUPPLY_RE = /^(\+.*|vcc|vdd|vbus|vbat|vsys|vin|vpp|v\+|3v3|5v|1v8|2v5|3\.3v?|v33|pwr)$/i;
const GROUND_RE = /^(-|gnd|vss|agnd|dgnd|pgnd|0v|ground|earth)$/i;
const CONTROL_SYMBOLS = new Set(["push-button", "spst-switch"]);

type Family = "supply" | "ground" | "control" | "bus" | "signal";

interface Placed {
  instance: ComponentInstance;
  center: Point;
  mainSpan: number;
  crossSpan: number;
  /** Terminal name -> point/side in screen space. */
  terminals: Map<string, { point: Point; side: TerminalSide; number?: string | null }>;
  layout: LayoutComponent;
}

interface Bus {
  name: string;
  color: string;
  /** Each net in the trunk, with its endpoint on the left and right component. */
  links: { net: Net; left: Point; right: Point }[];
}

/** Classify a net's family from its name and members. Buses are resolved separately. */
function familyOf(net: Net, symbolOf: (component: string) => string): Family {
  if (SUPPLY_RE.test(net.name)) return "supply";
  if (GROUND_RE.test(net.name)) return "ground";
  if (net.members.some((member) => CONTROL_SYMBOLS.has(symbolOf(member.component))))
    return "control";
  return "signal";
}

/**
 * Tap a terminal to a power rail. Left/right pins (and edge pins facing their own
 * rail) drop straight to it. An edge pin facing the *opposite* rail (e.g. a
 * module's bottom VCC pin reaching the top rail) hooks out of the pin and routes
 * up around the box's side, so it never crosses the body.
 */
function railTap(
  point: Point,
  side: TerminalSide,
  boxLeft: number,
  railY: number,
  railIsTop: boolean,
): { segments: Segment[]; junction: Point } {
  const straight = {
    segments: [{ from: point, to: { x: point.x, y: railY } }],
    junction: { x: point.x, y: railY },
  };
  if (side === "left" || side === "right") return straight;
  const facingDown = side === "bottom";
  if (facingDown !== railIsTop) return straight; // edge pin already faces this rail
  const stubY = point.y + (facingDown ? EDGE_STUB : -EDGE_STUB);
  const sideX = boxLeft - EDGE_STUB;
  return {
    segments: [
      { from: point, to: { x: point.x, y: stubY } },
      { from: { x: point.x, y: stubY }, to: { x: sideX, y: stubY } },
      { from: { x: sideX, y: stubY }, to: { x: sideX, y: railY } },
    ],
    junction: { x: sideX, y: railY },
  };
}

/**
 * Which box edge a terminal sits on, from its local (main, cross) position. This
 * is more reliable than the angle from the body center, which misreads a wide
 * module's outer pins (all on the bottom edge) as left/right.
 */
function edgeSide(main: number, cross: number, geom: ComponentGeom): TerminalSide {
  const eps = 0.5;
  if (Math.abs(cross - geom.crossSpan / 2) < eps) return "bottom";
  if (Math.abs(cross + geom.crossSpan / 2) < eps) return "top";
  if (Math.abs(main) < eps) return "left";
  if (Math.abs(main - geom.mainSpan) < eps) return "right";
  return cross >= 0 ? "bottom" : "top";
}

/**
 * Bus-rail layout: a left-to-right row of blocks (the most-connected one is the
 * hub) sits between a top supply rail and a bottom ground rail. Power pins tap
 * straight to their rail with a junction dot; groups of signals that run between
 * the same two blocks bundle into a single color-coded trunk with 45deg taps;
 * control inputs (buttons, switches) drop in as straight blue lines.
 */
export function layoutBusRail(model: SchematicModel): LayoutModel {
  const symbolOf = (id: string) =>
    model.components.find((component) => component.id === id)?.symbol ?? "";

  // ---- classify nets ------------------------------------------------------
  const families = new Map<string, Family>();
  for (const net of model.nets) families.set(net.name, familyOf(net, symbolOf));

  // Auto-detect buses: two-component nets bundled by the pair they connect, when
  // a pair shares three or more such nets. Power and control nets never bundle.
  const pairNets = new Map<string, Net[]>();
  for (const net of model.nets) {
    if (families.get(net.name) !== "signal") continue;
    const comps = [...new Set(net.members.map((member) => member.component))];
    if (comps.length !== 2) continue;
    const key = [...comps].sort().join(BUS_PAIR_SEPARATOR);
    const group = pairNets.get(key);
    if (group) group.push(net);
    else pairNets.set(key, [net]);
  }
  const busKeys = [...pairNets.entries()]
    .filter(([, nets]) => nets.length >= 3)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key]) => key);
  const busColorByKey = new Map<string, string>();
  busKeys.forEach((key, index) => {
    busColorByKey.set(key, BUS_PALETTE[index % BUS_PALETTE.length]!);
    for (const net of pairNets.get(key)!) families.set(net.name, "bus");
  });

  // ---- choose hub + order the row ----------------------------------------
  const netCount = new Map<string, number>();
  for (const net of model.nets) {
    for (const id of new Set(net.members.map((member) => member.component))) {
      netCount.set(id, (netCount.get(id) ?? 0) + 1);
    }
  }
  const isControlComp = (instance: ComponentInstance) => CONTROL_SYMBOLS.has(instance.symbol);

  const rowComps = model.components
    .filter((instance) => !isControlComp(instance))
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  const controlComps = model.components
    .filter(isControlComp)
    .sort((a, b) => a.sourceIndex - b.sourceIndex);

  // ---- place the main row (centers aligned on y = 0) ---------------------
  const placedById = new Map<string, Placed>();
  const place = (instance: ComponentInstance, centerX: number, centerY: number): Placed => {
    const geom = componentGeometry(instance);
    const left = centerX - geom.mainSpan / 2;
    const top = centerY - geom.crossSpan / 2;
    const center: Point = { x: centerX, y: centerY };
    const terminals = new Map<
      string,
      { point: Point; side: TerminalSide; number?: string | null }
    >();
    const layoutTerminals = geom.terminals.map((terminal) => {
      const point: Point = {
        x: left + terminal.main,
        y: top + terminal.cross + geom.crossSpan / 2,
      };
      const side = terminal.side ?? edgeSide(terminal.main, terminal.cross, geom);
      terminals.set(terminal.name, { point, side, number: terminal.number });
      return { name: terminal.name, point, side, number: terminal.number };
    });
    const layout: LayoutComponent = {
      id: instance.id,
      typeName: instance.typeName,
      symbol: instance.symbol,
      position: { x: left, y: top },
      size: { width: geom.mainSpan, height: geom.crossSpan },
      center,
      terminals: layoutTerminals,
      labels: instance.labels,
      roleMappings: instance.roleMappings,
      properties: instance.properties,
    };
    const placed: Placed = {
      instance,
      center,
      mainSpan: geom.mainSpan,
      crossSpan: geom.crossSpan,
      terminals,
      layout,
    };
    placedById.set(instance.id, placed);
    return placed;
  };

  let cursorX = 0;
  for (const instance of rowComps) {
    const geom = componentGeometry(instance);
    place(instance, cursorX + geom.mainSpan / 2, 0);
    cursorX += geom.mainSpan + COL_GAP;
  }

  // Control blocks sit in a band below the row, spread under the left half.
  const rowBottom = Math.max(
    ...[...placedById.values()].map((p) => p.center.y + p.crossSpan / 2),
    0,
  );
  const controlY = rowBottom + CONTROL_GAP;
  let controlX = 0;
  for (const instance of controlComps) {
    const geom = componentGeometry(instance);
    place(instance, controlX + geom.mainSpan / 2, controlY + geom.crossSpan / 2);
    controlX += geom.mainSpan + COL_GAP;
  }

  // ---- build wires --------------------------------------------------------
  const wires: LayoutWire[] = [];
  const labels: LayoutLabel[] = [];

  const termInfo = (component: string, terminal: string) =>
    placedById.get(component)?.terminals.get(terminal);
  const termPoint = (component: string, terminal: string): Point | undefined =>
    termInfo(component, terminal)?.point;
  const boxOf = (component: string) => {
    const placed = placedById.get(component);
    return placed
      ? {
          left: placed.center.x - placed.mainSpan / 2,
          right: placed.center.x + placed.mainSpan / 2,
        }
      : undefined;
  };

  // Power rails: gather every supply/ground tap, then run one rail across them.
  const contentTop = Math.min(...[...placedById.values()].map((p) => p.center.y - p.crossSpan / 2));
  const contentBottom = Math.max(
    ...[...placedById.values()].map((p) => p.center.y + p.crossSpan / 2),
  );
  const supplyRailY = contentTop - RAIL_MARGIN;
  const groundRailY = contentBottom + RAIL_MARGIN;

  const buildRail = (family: "supply" | "ground", railY: number, railIsTop: boolean): void => {
    const railNets = model.nets.filter((net) => families.get(net.name) === family);
    if (railNets.length === 0) return;
    const taps: { point: Point; side: TerminalSide; left: number; right: number }[] = [];
    for (const net of railNets) {
      for (const member of net.members) {
        const info = termInfo(member.component, member.terminal);
        const box = boxOf(member.component);
        if (info && box) taps.push({ point: info.point, side: info.side, ...box });
      }
    }
    if (taps.length === 0) return;
    const segments: Segment[] = [];
    const junctions: Point[] = [];
    for (const tap of taps) {
      const t = railTap(tap.point, tap.side, tap.left, railY, railIsTop);
      segments.push(...t.segments);
      junctions.push(t.junction);
    }
    const xs = junctions.map((point) => point.x);
    const railFromX = Math.min(...xs) - RAIL_PAD;
    const railToX = Math.max(...xs) + RAIL_PAD;
    const color = COLOR[family];
    segments.unshift({ from: { x: railFromX, y: railY }, to: { x: railToX, y: railY } });
    wires.push({
      net: railNets.map((net) => net.name).join("+"),
      anonymous: false,
      style: "wire",
      segments,
      junctions,
      color,
      width: WIDTH.rail,
    });
    labels.push({
      text: railNets[0]!.name,
      point: { x: railFromX - 6, y: railY - 6 },
      anchor: "start",
      kind: "rail-label",
      color,
    });
  };
  buildRail("supply", supplyRailY, true);
  buildRail("ground", groundRailY, false);

  // Buses: bundle each detected pair into a single trunk with 45deg taps.
  for (const key of busKeys) {
    const nets = pairNets.get(key)!;
    const color = busColorByKey.get(key)!;
    const [idA, idB] = key.split(BUS_PAIR_SEPARATOR) as [string, string];
    const a = placedById.get(idA);
    const b = placedById.get(idB);
    if (!a || !b) continue;
    const leftComp = a.center.x <= b.center.x ? a : b;
    const rightComp = leftComp === a ? b : a;

    const links: Bus["links"] = [];
    for (const net of nets) {
      const lMember = net.members.find((member) => member.component === leftComp.instance.id);
      const rMember = net.members.find((member) => member.component === rightComp.instance.id);
      const left = lMember && termPoint(lMember.component, lMember.terminal);
      const right = rMember && termPoint(rMember.component, rMember.terminal);
      if (left && right) links.push({ net, left, right });
    }
    if (links.length < 2) continue;
    emitBus(
      { name: shortBusName(leftComp.instance, rightComp.instance), color, links },
      wires,
      labels,
    );
  }

  // Control + plain signal nets that are not power or bus.
  let channelIndex = 0;
  for (const net of model.nets) {
    const family = families.get(net.name);
    if (family === "supply" || family === "ground" || family === "bus") continue;
    const infos = net.members
      .map((member) => termInfo(member.component, member.terminal))
      .filter((info): info is NonNullable<typeof info> => info !== undefined);
    if (infos.length < 2) continue;
    const color = family === "control" ? COLOR.control : COLOR.signal;
    const width = WIDTH.signal;
    const points = infos.map((info) => info.point);

    // A net that touches a module's top/bottom pin can't run at pin height
    // without slicing through the box, so route it as a trunk in a channel below
    // the row with vertical drops to each pin.
    if (
      family !== "control" &&
      infos.some((info) => info.side === "top" || info.side === "bottom")
    ) {
      const channelY = contentBottom + SIGNAL_CHANNEL + channelIndex * 14;
      channelIndex++;
      const xs = points.map((point) => point.x);
      const fromX = Math.min(...xs);
      const toX = Math.max(...xs);
      const segments: Segment[] = [
        { from: { x: fromX, y: channelY }, to: { x: toX, y: channelY } },
      ];
      const junctions: Point[] = [];
      for (const point of points) {
        segments.push({ from: { x: point.x, y: channelY }, to: point });
        if (point.x > fromX + 0.01 && point.x < toX - 0.01) {
          junctions.push({ x: point.x, y: channelY });
        }
      }
      wires.push({
        net: net.name,
        anonymous: net.anonymous,
        style: "wire",
        segments,
        junctions,
        color,
        width,
      });
      continue;
    }

    // Star from the first member to each other with a single sharp corner.
    // Control lines rise vertically out of the control, then turn into the pin;
    // plain signals turn the other way (horizontal first).
    const hub = points[0]!;
    const segments: Segment[] = [];
    for (let i = 1; i < points.length; i++) {
      const end = points[i]!;
      if (Math.abs(hub.y - end.y) < 0.01 || Math.abs(hub.x - end.x) < 0.01) {
        segments.push({ from: hub, to: end });
      } else {
        const corner: Point =
          family === "control" ? { x: hub.x, y: end.y } : { x: end.x, y: hub.y };
        segments.push({ from: hub, to: corner });
        segments.push({ from: corner, to: end });
      }
    }
    wires.push({
      net: net.name,
      anonymous: net.anonymous,
      style: "wire",
      segments,
      junctions: [],
      color,
      width,
    });
  }

  // Component glyphs draw their own id/value labels, so no header is added here.

  // ---- normalize to (MARGIN, MARGIN) and size ----------------------------
  const components = [...placedById.values()].map((placed) => placed.layout);
  const all: Point[] = [];
  for (const component of components) {
    all.push(component.position);
    all.push({
      x: component.position.x + component.size.width,
      y: component.position.y + component.size.height,
    });
  }
  for (const wire of wires) {
    for (const segment of wire.segments) all.push(segment.from, segment.to);
  }
  for (const label of labels) all.push(label.point);
  if (all.length === 0) all.push({ x: 0, y: 0 });
  const minX = Math.min(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxX = Math.max(...all.map((point) => point.x));
  const maxY = Math.max(...all.map((point) => point.y));
  const dx = MARGIN - minX;
  const dy = MARGIN - minY;

  const shiftPoint = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy });
  const shiftSeg = (segment: Segment): Segment => ({
    from: shiftPoint(segment.from),
    to: shiftPoint(segment.to),
  });

  return {
    size: { width: maxX - minX + 2 * MARGIN, height: maxY - minY + 2 * MARGIN },
    components: components.map((component) => ({
      ...component,
      position: shiftPoint(component.position),
      center: shiftPoint(component.center),
      terminals: component.terminals.map((terminal) => ({
        ...terminal,
        point: shiftPoint(terminal.point),
      })),
    })),
    wires: wires.map((wire) => ({
      ...wire,
      segments: wire.segments.map(shiftSeg),
      junctions: wire.junctions.map(shiftPoint),
    })),
    labels: labels.map((label) => ({ ...label, point: shiftPoint(label.point) })),
    noConnects: model.noConnects
      .map((noConnect) => termPoint(noConnect.component, noConnect.terminal))
      .filter((point): point is Point => point !== undefined)
      .map(shiftPoint),
    crossings: "hop",
    monospace: true,
    title: model.title,
    description: model.description,
  };
}

/**
 * Lay a single bus trunk. Each pin exits horizontally to a common knee line,
 * then runs a straight spoke to one shared entry point per side — so every
 * signal joins the trunk at the same point, forming a tidy funnel rather than a
 * spread-out chevron. Spokes share an endpoint and start at distinct heights on
 * the knee line, so they fan out without crossing each other or the leads.
 */
function emitBus(bus: Bus, wires: LayoutWire[], labels: LayoutLabel[]): void {
  const lefts = bus.links.map((link) => link.left);
  const rights = bus.links.map((link) => link.right);
  const trunkY =
    [...lefts, ...rights].reduce((sum, point) => sum + point.y, 0) / (lefts.length + rights.length);

  // Knee lines: a uniform horizontal lead past the busiest pin on each side.
  const leftKneeX = Math.max(...lefts.map((point) => point.x)) + BUS_LEAD;
  const rightKneeX = Math.min(...rights.map((point) => point.x)) - BUS_LEAD;
  // Single shared entry point per side, a fixed reach in from the knee line.
  // Using a fixed reach (rather than one derived from the pin spread) keeps the
  // trunk from collapsing when a block's bus pins are spread far apart.
  let apexLeftX = leftKneeX + BUS_APEX_REACH;
  let apexRightX = rightKneeX - BUS_APEX_REACH;
  if (apexLeftX >= apexRightX) {
    const mid = (apexLeftX + apexRightX) / 2;
    apexLeftX = mid;
    apexRightX = mid;
  }

  for (const link of bus.links) {
    wires.push({
      net: link.net.name,
      anonymous: false,
      style: "wire",
      segments: [
        { from: link.left, to: { x: leftKneeX, y: link.left.y } }, // horizontal lead
        { from: { x: leftKneeX, y: link.left.y }, to: { x: apexLeftX, y: trunkY } }, // spoke in
        { from: { x: apexRightX, y: trunkY }, to: { x: rightKneeX, y: link.right.y } }, // spoke out
        { from: { x: rightKneeX, y: link.right.y }, to: link.right }, // horizontal lead
      ],
      junctions: [],
      color: bus.color,
      width: WIDTH.tap,
    });
  }
  const trunkFromX = apexLeftX;
  const trunkToX = apexRightX;
  // The trunk itself: one thick decorative bundle line.
  wires.push({
    net: bus.name,
    anonymous: false,
    style: "wire",
    segments: [{ from: { x: trunkFromX, y: trunkY }, to: { x: trunkToX, y: trunkY } }],
    junctions: [],
    color: bus.color,
    width: WIDTH.bus,
  });
  labels.push({
    text: bus.name,
    point: { x: (trunkFromX + trunkToX) / 2, y: trunkY - 12 },
    anchor: "middle",
    kind: "bus-label",
    color: bus.color,
  });
}

function shortBusName(left: ComponentInstance, right: ComponentInstance): string {
  return `${left.id}-${right.id} bus`;
}
