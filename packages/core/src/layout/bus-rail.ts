import type { ComponentInstance, Net, SchematicModel } from "../model/types.js";
import type { ComponentGeom } from "./geometry.js";
import { componentGeometry, mirrorGeometry, rotateGeometry } from "./geometry.js";
import { assignLanes } from "./lanes.js";
import type { BridgeGroup, ChainGroup, PeripheralGroup } from "./peripherals.js";
import { detectPeripherals, memberIds } from "./peripherals.js";
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
const CONTROL_GAP = 70; // minimum vertical gap between the main row and the peripheral band
const BUS_LEAD = 18; // horizontal lead from a pin before its tap into a bus
const BUS_APEX_REACH = 24; // horizontal distance from the knee line to the shared entry point
const EDGE_STUB = 10; // stub out of a top/bottom (module) pin before it turns toward a rail
const SIGNAL_CHANNEL = 26; // first signal channel offset below the component row
const CHANNEL_STEP = 14; // vertical spacing between adjacent signal channels
const BAND_CLEAR = 16; // clearance between the last signal channel and the band
const CHAIN_GAP = 12; // vertical gap between consecutive parts of one chain
const BAND_GAP = 16; // minimum horizontal clearance between band items
const JOG = 12; // vertical clearance a displaced band item's feed jogs at
const BESIDE_GAP = 40; // horizontal gap between an anchor's box and a beside-bridge part
const KNEE_NEAR = 12; // breakout distance of the first beside-bridge feed
const KNEE_FAR = 24; // breakout distance of the second beside-bridge feed
const LABEL_CHAR_W = 6.6; // estimated advance of the 11px component-label font
const LANE_GAP = 12; // step between fanned-out hooks that would otherwise overlap
const CHANNEL_MIN_GAP = 26; // clearance between same-track channel trunks
const EPS = 0.01;
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

// `v\d+v\d*` covers dev-board rail spellings like V5V and V3V3.
const SUPPLY_RE =
  /^(\+.*|vcc|vdd|vbus|vbat|vsys|vin|vpp|v\+|3v3|5v|1v8|2v5|3\.3v?|v33|v\d+v\d*|pwr)$/i;
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
  /** A side is flat when every pin sits on a top/bottom edge at pin-row height. */
  leftFlat: boolean;
  rightFlat: boolean;
  /** Forced trunk level; set when any side is flat (the trunk runs in a channel). */
  trunkY?: number;
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
 * Bus-rail layout: a left-to-right row of blocks (in source order) sits between
 * a top supply rail and a bottom ground rail. Power pins tap
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

  // ---- detect peripherals -------------------------------------------------
  const familyLookup = (name: string): Family => families.get(name) ?? "signal";
  const instanceOf = (id: string) => model.components.find((component) => component.id === id);

  // Local-frame terminal side, known before placement, for picking each
  // peripheral group's placement recipe.
  const geomCache = new Map<string, ComponentGeom>();
  const geomOf = (id: string): ComponentGeom | undefined => {
    const cached = geomCache.get(id);
    if (cached) return cached;
    const instance = instanceOf(id);
    if (!instance) return undefined;
    const geom = componentGeometry(instance);
    geomCache.set(id, geom);
    return geom;
  };
  const sideOfTerminal = (componentId: string, terminal: string): TerminalSide | undefined => {
    const geom = geomOf(componentId);
    const term = geom?.terminals.find((candidate) => candidate.name === terminal);
    if (!geom || !term) return undefined;
    return term.side ?? edgeSide(term.main, term.cross, geom);
  };

  // A group hanging below a top-edge anchor pin would cross the anchor's body,
  // so those keep their main-row placement. Bridges fed from one left/right
  // edge sit beside the anchor; everything else hangs in the band below it.
  type Recipe =
    | { kind: "chain"; group: ChainGroup }
    | { kind: "bridge-below"; group: BridgeGroup }
    | { kind: "bridge-beside"; group: BridgeGroup; side: "left" | "right" };
  const recipes: Recipe[] = [];
  for (const group of detectPeripherals(model, familyLookup)) {
    if (group.kind === "chain") {
      const side = sideOfTerminal(group.anchorId, group.anchorTerminal);
      if (side && side !== "top") recipes.push({ kind: "chain", group });
      continue;
    }
    const sides = group.links.map((link) => sideOfTerminal(group.anchorId, link.anchorTerminal));
    if (sides.some((side) => side === undefined || side === "top")) continue;
    if (sides[0] === sides[1] && (sides[0] === "left" || sides[0] === "right")) {
      recipes.push({ kind: "bridge-beside", group, side: sides[0] });
    } else {
      recipes.push({ kind: "bridge-below", group });
    }
  }
  const peripheralIds = new Set(recipes.flatMap((recipe) => memberIds(recipe.group)));

  // Nets a peripheral recipe routes itself; the generic loops skip them. Rail
  // nets stay out so chain tails tap the rails like any other member.
  const routedNets = new Set<string>();
  for (const recipe of recipes) {
    if (recipe.kind === "chain") {
      for (const element of recipe.group.elements) routedNets.add(element.upstreamNet.name);
    } else {
      for (const link of recipe.group.links) routedNets.add(link.net.name);
    }
  }

  // ---- order the row (source order) --------------------------------------
  const isControlComp = (instance: ComponentInstance) => CONTROL_SYMBOLS.has(instance.symbol);

  const rowComps = model.components
    .filter((instance) => !peripheralIds.has(instance.id) && !isControlComp(instance))
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  const controlComps = model.components
    .filter((instance) => !peripheralIds.has(instance.id) && isControlComp(instance))
    .sort((a, b) => a.sourceIndex - b.sourceIndex);

  // ---- place the main row (centers aligned on y = 0) ---------------------
  const placedById = new Map<string, Placed>();
  const place = (
    instance: ComponentInstance,
    centerX: number,
    centerY: number,
    geomOverride?: ComponentGeom,
  ): Placed => {
    const geom = geomOverride ?? componentGeometry(instance);
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

  // Widest label of an instance, for keeping band items and their side labels
  // clear of each other.
  const labelSpan = (instance: ComponentInstance): number =>
    Math.max(0, ...instance.labels.map((label) => label.length)) * LABEL_CHAR_W;

  // Beside-bridges occupy the gap to the right of their anchor; widen that
  // column so bus funnels and neighbors stay clear.
  const besideExtra = new Map<string, number>();
  for (const recipe of recipes) {
    if (recipe.kind !== "bridge-beside") continue;
    const part = componentGeometry(recipe.group.element);
    const extra = BESIDE_GAP + part.crossSpan + labelSpan(recipe.group.element);
    besideExtra.set(recipe.group.anchorId, (besideExtra.get(recipe.group.anchorId) ?? 0) + extra);
  }

  let cursorX = 0;
  for (const instance of rowComps) {
    const geom = componentGeometry(instance);
    place(instance, cursorX + geom.mainSpan / 2, 0);
    cursorX += geom.mainSpan + COL_GAP + (besideExtra.get(instance.id) ?? 0);
  }

  const rowBottom = Math.max(
    ...[...placedById.values()].map((p) => p.center.y + p.crossSpan / 2),
    0,
  );

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

  // Resolve each bus's links and whether each of its two sides is "flat" —
  // fed from top/bottom-edge module pins that all share the pin-row height. A
  // flat side cannot host the classic horizontal funnel (its leads would run
  // along the pin row, over foreign pins and other buses), so flat buses drop
  // their trunk into a channel below the row instead.
  interface BusPlan {
    key: string;
    name: string;
    color: string;
    links: Bus["links"];
    leftFlat: boolean;
    rightFlat: boolean;
  }
  const busPlans: BusPlan[] = [];
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
    const flat = { left: true, right: true };
    for (const net of nets) {
      const lMember = net.members.find((member) => member.component === leftComp.instance.id);
      const rMember = net.members.find((member) => member.component === rightComp.instance.id);
      const lInfo = lMember && termInfo(lMember.component, lMember.terminal);
      const rInfo = rMember && termInfo(rMember.component, rMember.terminal);
      if (!lInfo || !rInfo) continue;
      links.push({ net, left: lInfo.point, right: rInfo.point });
      if (lInfo.side !== "top" && lInfo.side !== "bottom") flat.left = false;
      if (rInfo.side !== "top" && rInfo.side !== "bottom") flat.right = false;
    }
    if (links.length < 2) continue;
    busPlans.push({
      key,
      name: shortBusName(leftComp.instance, rightComp.instance),
      color,
      links,
      leftFlat: flat.left,
      rightFlat: flat.right,
    });
  }

  // Signal nets that must run in a channel below the row (they touch a module's
  // top/bottom pin and can't run at pin height without slicing through the
  // box), plus flat-bus trunks. Channels pack into shared tracks — runs whose
  // x-extents are clear of each other sit at one level, overlapping runs are
  // guaranteed distinct levels. Resolved before the band is placed so the band
  // clears every track; the routing loop below reads this same map to stay in
  // lockstep.
  type ChannelItem = { kind: "net"; net: Net } | { kind: "bus"; key: string };
  const channelCandidates: { item: ChannelItem; order: number; fromX: number; toX: number }[] = [];
  model.nets.forEach((net, order) => {
    const family = families.get(net.name);
    if (family === "supply" || family === "ground" || family === "bus" || family === "control") {
      return;
    }
    if (routedNets.has(net.name)) return;
    const infos = net.members
      .map((member) => termInfo(member.component, member.terminal))
      .filter((info): info is NonNullable<typeof info> => info !== undefined);
    if (infos.length < 2) return;
    if (!infos.some((info) => info.side === "top" || info.side === "bottom")) return;
    const xs = infos.map((info) => info.point.x);
    channelCandidates.push({
      item: { kind: "net", net },
      order,
      fromX: Math.min(...xs),
      toX: Math.max(...xs),
    });
  });
  busPlans.forEach((plan, index) => {
    if (!plan.leftFlat && !plan.rightFlat) return;
    const xs = plan.links.flatMap((link) => [link.left.x, link.right.x]);
    channelCandidates.push({
      item: { kind: "bus", key: plan.key },
      order: model.nets.length + index,
      fromX: Math.min(...xs),
      toX: Math.max(...xs),
    });
  });
  channelCandidates.sort((a, b) => a.fromX - b.fromX || a.toX - b.toX || a.order - b.order);
  const channelTracks = new Map<string, number>();
  const busTrunkTracks = new Map<string, number>();
  let channelTrackCount = 0;
  for (const [entry, track] of assignLanes(
    channelCandidates.map((entry) => ({ item: entry, lo: entry.fromX, hi: entry.toX })),
    CHANNEL_MIN_GAP,
  )) {
    if (entry.item.kind === "net") channelTracks.set(entry.item.net.name, track);
    else busTrunkTracks.set(entry.item.key, track);
    channelTrackCount = Math.max(channelTrackCount, track + 1);
  }

  // The peripheral band sits below the row, past every signal channel.
  const bandY =
    rowBottom +
    Math.max(CONTROL_GAP, SIGNAL_CHANNEL + channelTrackCount * CHANNEL_STEP + BAND_CLEAR);

  // Legacy control blocks (whose shape detection bailed on) keep their packed
  // placement at the left of the band.
  let controlX = 0;
  let bandCursor = Number.NEGATIVE_INFINITY;
  for (const instance of controlComps) {
    const geom = componentGeometry(instance);
    place(instance, controlX + geom.mainSpan / 2, bandY + geom.crossSpan / 2);
    bandCursor = Math.max(bandCursor, controlX + geom.mainSpan);
    controlX += geom.mainSpan + COL_GAP;
  }

  // ---- place peripherals and route their nets -----------------------------
  const pushPeripheralWire = (net: Net, segments: Segment[]): void => {
    const kept = segments.filter(
      (segment) =>
        Math.abs(segment.from.x - segment.to.x) > EPS ||
        Math.abs(segment.from.y - segment.to.y) > EPS,
    );
    if (kept.length === 0) return;
    wires.push({
      net: net.name,
      anonymous: net.anonymous,
      style: "wire",
      segments: kept,
      junctions: [],
      color: familyLookup(net.name) === "control" ? COLOR.control : COLOR.signal,
      width: WIDTH.signal,
    });
  };

  // A peripheral part stands vertically with its upstream terminal on top;
  // mirroring before rotating is what flips a part so its polarity faces the
  // wire that feeds it (LED anode toward the resistor, speaker + toward OUTP).
  const verticalPartGeom = (instance: ComponentInstance, upstreamTerminal: string) => {
    const base = componentGeometry(instance);
    const upstreamFirst = base.terminals[0]!.name === upstreamTerminal;
    return rotateGeometry(upstreamFirst ? base : mirrorGeometry(base));
  };

  const placeChain = (group: ChainGroup, chainX: number, jogY: number | null): void => {
    const anchor = termInfo(group.anchorId, group.anchorTerminal);
    if (!anchor) return;
    let topY = bandY;
    let prevPoint = anchor.point;
    let first = true;
    for (const element of group.elements) {
      const geomV = verticalPartGeom(element.instance, element.upstreamTerminal);
      place(element.instance, chainX, topY + geomV.crossSpan / 2, geomV);
      const top = termPoint(element.instance.id, element.upstreamTerminal)!;
      let segments: Segment[];
      if (first && (anchor.side === "left" || anchor.side === "right")) {
        // A side pin breaks out horizontally first; dropping at the pin's own
        // x would run along the box edge, collinear with other side-pin drops.
        segments = [
          { from: prevPoint, to: { x: top.x, y: prevPoint.y } },
          { from: { x: top.x, y: prevPoint.y }, to: top },
        ];
      } else if (first && jogY !== null) {
        segments = [
          { from: prevPoint, to: { x: prevPoint.x, y: jogY } },
          { from: { x: prevPoint.x, y: jogY }, to: { x: top.x, y: jogY } },
          { from: { x: top.x, y: jogY }, to: top },
        ];
      } else {
        segments = [{ from: prevPoint, to: top }];
      }
      pushPeripheralWire(element.upstreamNet, segments);
      prevPoint = termPoint(element.instance.id, element.downstreamTerminal)!;
      topY += geomV.crossSpan + CHAIN_GAP;
      first = false;
    }
  };

  const placeBridgeBelow = (group: BridgeGroup, partX: number, jogY: number | null): void => {
    const [linkA, linkB] = group.links;
    const pinA = termPoint(group.anchorId, linkA.anchorTerminal);
    const pinB = termPoint(group.anchorId, linkB.anchorTerminal);
    if (!pinA || !pinB) return;
    const topLink = pinA.x <= pinB.x ? linkA : linkB;
    const botLink = topLink === linkA ? linkB : linkA;
    const topPin = topLink === linkA ? pinA : pinB;
    const botPin = topLink === linkA ? pinB : pinA;
    const geomV = verticalPartGeom(group.element, topLink.elementTerminal);
    place(group.element, partX, bandY + geomV.crossSpan / 2, geomV);
    const topTerm = termPoint(group.element.id, topLink.elementTerminal)!;
    const botTerm = termPoint(group.element.id, botLink.elementTerminal)!;
    pushPeripheralWire(
      topLink.net,
      jogY !== null
        ? [
            { from: topPin, to: { x: topPin.x, y: jogY } },
            { from: { x: topPin.x, y: jogY }, to: { x: topTerm.x, y: jogY } },
            { from: { x: topTerm.x, y: jogY }, to: topTerm },
          ]
        : [{ from: topPin, to: topTerm }],
    );
    // The second feed drops beside the part and hooks into its far terminal.
    pushPeripheralWire(botLink.net, [
      { from: botPin, to: { x: botPin.x, y: botTerm.y } },
      { from: { x: botPin.x, y: botTerm.y }, to: botTerm },
    ]);
  };

  const besideCount = new Map<string, number>();
  const placeBridgeBeside = (group: BridgeGroup, side: "left" | "right"): void => {
    const [linkA, linkB] = group.links;
    const pinA = termPoint(group.anchorId, linkA.anchorTerminal);
    const pinB = termPoint(group.anchorId, linkB.anchorTerminal);
    const box = boxOf(group.anchorId);
    if (!pinA || !pinB || !box) return;
    const upLink = pinA.y <= pinB.y ? linkA : linkB;
    const dnLink = upLink === linkA ? linkB : linkA;
    const upPin = upLink === linkA ? pinA : pinB;
    const dnPin = upLink === linkA ? pinB : pinA;
    const geomV = verticalPartGeom(group.element, upLink.elementTerminal);
    const dir = side === "right" ? 1 : -1;
    const edge = side === "right" ? box.right : box.left;
    const index = besideCount.get(group.anchorId) ?? 0;
    besideCount.set(group.anchorId, index + 1);
    const partX =
      edge + dir * (BESIDE_GAP + index * (BESIDE_GAP + geomV.mainSpan + labelSpan(group.element)));
    const cy = (upPin.y + dnPin.y) / 2;
    place(group.element, partX, cy, geomV);
    const topTerm = termPoint(group.element.id, upLink.elementTerminal)!;
    const botTerm = termPoint(group.element.id, dnLink.elementTerminal)!;
    // Each feed breaks out a different distance before turning, so the two
    // wires never overlap.
    const kneeNear = edge + dir * KNEE_NEAR;
    const kneeFar = edge + dir * KNEE_FAR;
    pushPeripheralWire(upLink.net, [
      { from: upPin, to: { x: kneeNear, y: upPin.y } },
      { from: { x: kneeNear, y: upPin.y }, to: { x: kneeNear, y: topTerm.y } },
      { from: { x: kneeNear, y: topTerm.y }, to: topTerm },
    ]);
    pushPeripheralWire(dnLink.net, [
      { from: dnPin, to: { x: kneeFar, y: dnPin.y } },
      { from: { x: kneeFar, y: dnPin.y }, to: { x: kneeFar, y: botTerm.y } },
      { from: { x: kneeFar, y: botTerm.y }, to: botTerm },
    ]);
  };

  // Band items (chains and below-bridges) go under their anchor pin; a
  // left-to-right sweep shifts an item right when it would collide with the
  // previous one, and its feed then jogs sideways above the band.
  interface BandPlan {
    recipe: Recipe;
    desiredX: number;
    leftExtent: number;
    rightExtent: number;
    order: number;
  }
  const plans: BandPlan[] = [];
  for (const recipe of recipes) {
    if (recipe.kind === "bridge-beside") {
      placeBridgeBeside(recipe.group, recipe.side);
      continue;
    }
    if (recipe.kind === "chain") {
      const group = recipe.group;
      const anchor = termInfo(group.anchorId, group.anchorTerminal);
      if (!anchor) continue;
      // A side-pin chain hangs clear of the box edge, where other side pins
      // drop to the rails.
      const sideOut = anchor.side === "left" ? -KNEE_FAR : anchor.side === "right" ? KNEE_FAR : 0;
      const widths = group.elements.map(
        (element) => verticalPartGeom(element.instance, element.upstreamTerminal).mainSpan,
      );
      const halfW = Math.max(...widths) / 2;
      const widestLabel = Math.max(...group.elements.map((element) => labelSpan(element.instance)));
      plans.push({
        recipe,
        desiredX: anchor.point.x + sideOut,
        leftExtent: halfW,
        rightExtent: halfW + widestLabel,
        order: Math.min(...group.elements.map((element) => element.instance.sourceIndex)),
      });
      continue;
    }
    const group = recipe.group;
    const pinA = termPoint(group.anchorId, group.links[0].anchorTerminal);
    const pinB = termPoint(group.anchorId, group.links[1].anchorTerminal);
    if (!pinA || !pinB) continue;
    const geomV = verticalPartGeom(group.element, group.links[0].elementTerminal);
    const halfW = geomV.mainSpan / 2;
    plans.push({
      recipe,
      desiredX: Math.min(pinA.x, pinB.x),
      leftExtent: halfW,
      rightExtent: Math.max(Math.abs(pinA.x - pinB.x), halfW + labelSpan(group.element)),
      order: group.element.sourceIndex,
    });
  }
  plans.sort((a, b) => a.desiredX - b.desiredX || a.order - b.order);
  let jogCount = 0;
  for (const plan of plans) {
    const x = Math.max(plan.desiredX, bandCursor + BAND_GAP + plan.leftExtent);
    const shifted = x - plan.desiredX > EPS;
    const jogY = shifted ? bandY - JOG - jogCount * 6 : null;
    if (shifted) jogCount += 1;
    if (plan.recipe.kind === "chain") placeChain(plan.recipe.group, x, jogY);
    else if (plan.recipe.kind === "bridge-below") placeBridgeBelow(plan.recipe.group, x, jogY);
    bandCursor = x + plan.rightExtent;
  }

  // Power rails: gather every supply/ground tap, then run one rail across them.
  const contentTop = Math.min(...[...placedById.values()].map((p) => p.center.y - p.crossSpan / 2));
  const contentBottom = Math.max(
    ...[...placedById.values()].map((p) => p.center.y + p.crossSpan / 2),
  );
  const supplyRailY = contentTop - RAIL_MARGIN;
  const groundRailY = contentBottom + RAIL_MARGIN;

  // Hooked rail taps fan out per component side, counted across both rails, so
  // no two hooks share a path.
  const hookCounts = new Map<string, number>();
  const nextHook = (componentId: string, dir: "left" | "right"): number => {
    const key = `${componentId}:${dir}`;
    const count = hookCounts.get(key) ?? 0;
    hookCounts.set(key, count + 1);
    return count;
  };
  // True when a straight vertical from `point` to `railY` would pass through
  // another terminal of the same component (stacked side pins share one x).
  const dropPassesTerminal = (componentId: string, point: Point, railY: number): boolean => {
    const placed = placedById.get(componentId);
    if (!placed) return false;
    const lo = Math.min(point.y, railY);
    const hi = Math.max(point.y, railY);
    for (const terminal of placed.terminals.values()) {
      const other = terminal.point;
      if (Math.abs(other.x - point.x) > EPS) continue;
      if (Math.abs(other.y - point.y) < EPS) continue; // the tap itself
      if (other.y > lo + EPS && other.y < hi - EPS) return true;
    }
    return false;
  };

  interface RailTapSite {
    componentId: string;
    point: Point;
    side: TerminalSide;
    left: number;
    right: number;
  }

  /**
   * Tap a terminal to a power rail. Left/right pins (and edge pins facing
   * their own rail) drop straight to it — unless the drop would slice through
   * the component's other pins, in which case it breaks out sideways first.
   * An edge pin facing the *opposite* rail (e.g. a module's bottom VCC pin
   * reaching the top rail) hooks out of the pin and routes up around the box's
   * side. Consecutive hooks on one side step further out (`LANE_GAP`) so their
   * runs never overlap — each escapes a different distance before turning.
   */
  const railTap = (
    tap: RailTapSite,
    railY: number,
    railIsTop: boolean,
  ): { segments: Segment[]; junction: Point } => {
    const { point, side } = tap;
    const straight = {
      segments: [{ from: point, to: { x: point.x, y: railY } }],
      junction: { x: point.x, y: railY },
    };
    if (side === "left" || side === "right") {
      if (!dropPassesTerminal(tap.componentId, point, railY)) return straight;
      const k = nextHook(tap.componentId, side);
      const outX =
        side === "left"
          ? tap.left - EDGE_STUB - k * LANE_GAP
          : tap.right + EDGE_STUB + k * LANE_GAP;
      return {
        segments: [
          { from: point, to: { x: outX, y: point.y } },
          { from: { x: outX, y: point.y }, to: { x: outX, y: railY } },
        ],
        junction: { x: outX, y: railY },
      };
    }
    const facingDown = side === "bottom";
    if (facingDown !== railIsTop) return straight; // edge pin already faces this rail
    const reach = EDGE_STUB + nextHook(tap.componentId, "left") * LANE_GAP;
    const stubY = point.y + (facingDown ? reach : -reach);
    const sideX = tap.left - reach;
    return {
      segments: [
        { from: point, to: { x: point.x, y: stubY } },
        { from: { x: point.x, y: stubY }, to: { x: sideX, y: stubY } },
        { from: { x: sideX, y: stubY }, to: { x: sideX, y: railY } },
      ],
      junction: { x: sideX, y: railY },
    };
  };

  const buildRail = (family: "supply" | "ground", railY: number, railIsTop: boolean): void => {
    const railNets = model.nets.filter((net) => families.get(net.name) === family);
    if (railNets.length === 0) return;
    const taps: RailTapSite[] = [];
    for (const net of railNets) {
      for (const member of net.members) {
        const info = termInfo(member.component, member.terminal);
        const box = boxOf(member.component);
        if (info && box) {
          taps.push({ componentId: member.component, point: info.point, side: info.side, ...box });
        }
      }
    }
    if (taps.length === 0) return;
    const segments: Segment[] = [];
    const junctions: Point[] = [];
    for (const tap of taps) {
      const t = railTap(tap, railY, railIsTop);
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

  // Buses: bundle each detected pair into a single trunk with 45deg taps. A
  // flat bus runs its trunk in a packed channel below the row.
  for (const plan of busPlans) {
    const track = busTrunkTracks.get(plan.key);
    emitBus(
      {
        name: plan.name,
        color: plan.color,
        links: plan.links,
        leftFlat: plan.leftFlat,
        rightFlat: plan.rightFlat,
        trunkY: track === undefined ? undefined : rowBottom + SIGNAL_CHANNEL + track * CHANNEL_STEP,
      },
      wires,
      labels,
    );
  }

  // Control + plain signal nets that are not power, bus, or peripheral-routed.
  const starMidCounts = new Map<number, number>();
  for (const net of model.nets) {
    const family = families.get(net.name);
    if (family === "supply" || family === "ground" || family === "bus") continue;
    if (routedNets.has(net.name)) continue;
    const infos = net.members
      .map((member) => termInfo(member.component, member.terminal))
      .filter((info): info is NonNullable<typeof info> => info !== undefined);
    if (infos.length < 2) continue;
    const color = family === "control" ? COLOR.control : COLOR.signal;
    const width = WIDTH.signal;
    const points = infos.map((info) => info.point);

    // A net that touches a module's top/bottom pin can't run at pin height
    // without slicing through the box, so route it as a trunk in a channel just
    // below the row with vertical drops to each pin. Anchored to `rowBottom`, not
    // `contentBottom`, so the channel stays under the row rather than dropping
    // below the peripheral band (whose drops back up would cross the band).
    const channelTrack = channelTracks.get(net.name);
    if (channelTrack !== undefined) {
      const channelY = rowBottom + SIGNAL_CHANNEL + channelTrack * CHANNEL_STEP;
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

    // Star from the first member to each other. Two facing side pins take a Z
    // through the corridor between the boxes — staggered per corridor so
    // parallel nets keep distinct verticals — because a corner at either pin's
    // x would run along a box edge, through its other pins. Control lines rise
    // vertically out of the control, then turn into the pin; remaining shapes
    // keep a single corner (horizontal first).
    const hubInfo = infos[0]!;
    const hub = hubInfo.point;
    const segments: Segment[] = [];
    for (let i = 1; i < infos.length; i++) {
      const endInfo = infos[i]!;
      const end = endInfo.point;
      if (Math.abs(hub.y - end.y) < EPS || Math.abs(hub.x - end.x) < EPS) {
        segments.push({ from: hub, to: end });
        continue;
      }
      const towardSide = (side: TerminalSide, fromX: number, toX: number): boolean =>
        side === "right" ? toX > fromX : side === "left" && toX < fromX;
      const baseMid = (hub.x + end.x) / 2;
      if (
        family !== "control" &&
        towardSide(hubInfo.side, hub.x, baseMid) &&
        towardSide(endInfo.side, end.x, baseMid)
      ) {
        const corridor = Math.round(baseMid);
        const k = starMidCounts.get(corridor) ?? 0;
        starMidCounts.set(corridor, k + 1);
        const midX = baseMid + k * LANE_GAP;
        segments.push({ from: hub, to: { x: midX, y: hub.y } });
        segments.push({ from: { x: midX, y: hub.y }, to: { x: midX, y: end.y } });
        segments.push({ from: { x: midX, y: end.y }, to: end });
        continue;
      }
      const corner: Point = family === "control" ? { x: hub.x, y: end.y } : { x: end.x, y: hub.y };
      segments.push({ from: hub, to: corner });
      segments.push({ from: corner, to: end });
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
 * Lay a single bus trunk. On an IC side, each pin exits horizontally to a
 * common knee line, then runs a straight spoke to one shared entry point — so
 * every signal joins the trunk at the same point, forming a tidy funnel rather
 * than a spread-out chevron. On a flat (module-pin) side the leads instead
 * drop vertically to a knee level above the trunk's channel, then spoke to the
 * shared entry point. Spokes share an endpoint and start at distinct spots on
 * the knee line, so they fan out without crossing each other or the leads.
 */
function emitBus(bus: Bus, wires: LayoutWire[], labels: LayoutLabel[]): void {
  const lefts = bus.links.map((link) => link.left);
  const rights = bus.links.map((link) => link.right);
  const trunkY =
    bus.trunkY ??
    [...lefts, ...rights].reduce((sum, point) => sum + point.y, 0) / (lefts.length + rights.length);
  const kneeY = trunkY - BUS_LEAD;

  // Knee lines: a uniform horizontal lead past the busiest pin on each side.
  // A flat side has no horizontal lead; its apex sits just past its last pin.
  const leftKneeX = Math.max(...lefts.map((point) => point.x)) + (bus.leftFlat ? 0 : BUS_LEAD);
  const rightKneeX = Math.min(...rights.map((point) => point.x)) - (bus.rightFlat ? 0 : BUS_LEAD);
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
    const leadIn: Segment[] = bus.leftFlat
      ? [
          { from: link.left, to: { x: link.left.x, y: kneeY } }, // vertical lead
          { from: { x: link.left.x, y: kneeY }, to: { x: apexLeftX, y: trunkY } }, // spoke in
        ]
      : [
          { from: link.left, to: { x: leftKneeX, y: link.left.y } }, // horizontal lead
          { from: { x: leftKneeX, y: link.left.y }, to: { x: apexLeftX, y: trunkY } }, // spoke in
        ];
    const leadOut: Segment[] = bus.rightFlat
      ? [
          { from: { x: apexRightX, y: trunkY }, to: { x: link.right.x, y: kneeY } }, // spoke out
          { from: { x: link.right.x, y: kneeY }, to: link.right }, // vertical lead
        ]
      : [
          { from: { x: apexRightX, y: trunkY }, to: { x: rightKneeX, y: link.right.y } }, // spoke out
          { from: { x: rightKneeX, y: link.right.y }, to: link.right }, // horizontal lead
        ];
    wires.push({
      net: link.net.name,
      anonymous: false,
      style: "wire",
      segments: [...leadIn, ...leadOut],
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
