import type { LayoutComponent, Point } from "../layout/types.js";
import { circle, escapeText, fmt, line, polygon, polylinePath, rect, text } from "./svg-serializer.js";

const LED_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  white: "#f3f4f6",
  amber: "#f59e0b",
};

/** A local coordinate frame: `along` runs p0->p1, `perp` is the left normal. */
type Frame = (along: number, perp: number) => Point;

function makeFrame(p0: Point, p1: Point): { M: Frame; len: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const M: Frame = (along, perp) => ({ x: p0.x + ux * along + px * perp, y: p0.y + uy * along + py * perp });
  return { M, len };
}

function localPath(M: Frame, pts: readonly [number, number][], cls = "wire-symbol", extra = ""): string {
  return polylinePath(
    pts.map(([a, b]) => M(a, b)),
    cls,
    extra,
  );
}

function ledColor(component: LayoutComponent): string | null {
  const color = component.properties.find((property) => property.name === "color")?.raw;
  return color ? (LED_COLORS[color] ?? null) : null;
}

const LEAD = 14;

function drawResistor(M: Frame, len: number): string {
  const start = LEAD;
  const end = len - LEAD;
  const span = end - start;
  const teeth = 6;
  const points: [number, number][] = [
    [0, 0],
    [start, 0],
  ];
  for (let i = 0; i < teeth; i += 1) {
    const a = start + (span * (i + 0.5)) / teeth;
    points.push([a, i % 2 === 0 ? -7 : 7]);
  }
  points.push([end, 0], [len, 0]);
  return localPath(M, points);
}

function drawCapacitor(M: Frame, len: number, polarized: boolean): string {
  const c = len / 2;
  const parts = [
    localPath(M, [
      [0, 0],
      [c - 3, 0],
    ]),
    localPath(M, [
      [c + 3, 0],
      [len, 0],
    ]),
    line(M(c - 3, -10), M(c - 3, 10), "wire-symbol"),
  ];
  if (polarized) {
    parts.push(
      polylinePath([M(c + 3, -8), M(c + 6, -5), M(c + 6, 5), M(c + 3, 8)], "wire-symbol"),
      text("+", M(c - 8, -11), "middle", "wire-pin-label"),
    );
  } else {
    parts.push(line(M(c + 3, -10), M(c + 3, 10), "wire-symbol"));
  }
  return parts.join("");
}

function drawInductor(M: Frame, len: number): string {
  const start = LEAD;
  const end = len - LEAD;
  const bumps = 4;
  const width = (end - start) / bumps;
  const radius = width / 2;
  const points: Point[] = [M(0, 0), M(start, 0)];
  for (let i = 0; i < bumps; i += 1) {
    const center = start + (i + 0.5) * width;
    for (let step = 0; step <= 8; step += 1) {
      const theta = Math.PI * (step / 8);
      points.push(M(center - radius * Math.cos(theta), -radius * Math.sin(theta)));
    }
  }
  points.push(M(end, 0), M(len, 0));
  return polylinePath(points, "wire-symbol");
}

function drawDiode(M: Frame, len: number, component: LayoutComponent, led: boolean): string {
  const c = len / 2;
  const fill = led ? (ledColor(component) ?? "#9ca3af") : "#1f2937";
  const parts = [
    localPath(M, [
      [0, 0],
      [c - 7, 0],
    ]),
    localPath(M, [
      [c + 7, 0],
      [len, 0],
    ]),
    polygon([M(c - 7, -8), M(c - 7, 8), M(c + 7, 0)], "wire-symbol-fill", ` fill="${fill}"`),
    line(M(c + 7, -8), M(c + 7, 8), "wire-symbol"),
  ];
  if (led) {
    parts.push(
      localPath(M, [
        [c + 2, -10],
        [c + 8, -16],
      ]),
      polygon([M(c + 8, -16), M(c + 5, -14), M(c + 8, -12)], "wire-symbol-fill"),
      localPath(M, [
        [c + 7, -8],
        [c + 13, -14],
      ]),
      polygon([M(c + 13, -14), M(c + 10, -12), M(c + 13, -10)], "wire-symbol-fill"),
    );
  }
  return parts.join("");
}

function drawBattery(M: Frame, len: number): string {
  const c = len / 2;
  return [
    localPath(M, [
      [0, 0],
      [c - 7, 0],
    ]),
    localPath(M, [
      [c + 7, 0],
      [len, 0],
    ]),
    line(M(c - 7, -11), M(c - 7, 11), "wire-symbol"),
    line(M(c - 3, -6), M(c - 3, 6), "wire-symbol"),
    line(M(c + 3, -11), M(c + 3, 11), "wire-symbol"),
    line(M(c + 7, -6), M(c + 7, 6), "wire-symbol"),
  ].join("");
}

function drawSwitch(M: Frame, len: number, pushButton: boolean): string {
  const c = len / 2;
  const parts = [
    localPath(M, [
      [0, 0],
      [c - 8, 0],
    ]),
    localPath(M, [
      [c + 8, 0],
      [len, 0],
    ]),
    circle(M(c - 8, 0), 1.6, "wire-symbol-fill"),
    circle(M(c + 8, 0), 1.6, "wire-symbol-fill"),
  ];
  if (pushButton) {
    parts.push(
      line(M(c - 8, -11), M(c + 8, -11), "wire-symbol"),
      localPath(M, [
        [c, -11],
        [c, -17],
      ]),
    );
  } else {
    parts.push(
      localPath(M, [
        [c - 8, 0],
        [c + 7, -10],
      ]),
    );
  }
  return parts.join("");
}

function drawGround(component: LayoutComponent): string {
  const terminal = component.terminals[0];
  if (!terminal) return "";
  const t = terminal.point;
  const c = component.center;
  const { M, len } = makeFrame(t, c);
  return [
    localPath(M, [
      [0, 0],
      [len * 0.45, 0],
    ]),
    line(M(len * 0.45, -12), M(len * 0.45, 12), "wire-symbol"),
    line(M(len * 0.68, -8), M(len * 0.68, 8), "wire-symbol"),
    line(M(len * 0.9, -4), M(len * 0.9, 4), "wire-symbol"),
  ].join("");
}

function boundaryPoint(from: Point, to: Point, radius: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: to.x - (dx / d) * radius, y: to.y - (dy / d) * radius };
}

function drawTransistor(component: LayoutComponent, pnp: boolean): string {
  const center = component.center;
  const radius = 17;
  const byRole = (role: string): Point | null => {
    const name = component.roleMappings.find((mapping) => mapping.role === role)?.terminal;
    const terminal = component.terminals.find((entry) => entry.name === name);
    return terminal ? terminal.point : null;
  };
  const base = byRole("base") ?? component.terminals[0]?.point ?? center;
  const collector = byRole("collector") ?? component.terminals[1]?.point ?? center;
  const emitter = byRole("emitter") ?? component.terminals[2]?.point ?? center;

  const baseEdge = boundaryPoint(center, base, radius);
  // Base bar sits just inside the envelope, perpendicular to the base lead.
  const bdx = baseEdge.x - center.x;
  const bdy = baseEdge.y - center.y;
  const bd = Math.hypot(bdx, bdy) || 1;
  const nx = -bdy / bd;
  const ny = bdx / bd;
  const barInner = { x: center.x - (bdx / bd) * (radius * 0.45), y: center.y - (bdy / bd) * (radius * 0.45) };
  const barA = { x: barInner.x + nx * 9, y: barInner.y + ny * 9 };
  const barB = { x: barInner.x - nx * 9, y: barInner.y - ny * 9 };

  const collInner = { x: barInner.x + nx * 5, y: barInner.y + ny * 5 };
  const emitInner = { x: barInner.x - nx * 5, y: barInner.y - ny * 5 };
  const collEdge = boundaryPoint(center, collector, radius);
  const emitEdge = boundaryPoint(center, emitter, radius);
  const arrowTarget = pnp ? emitInner : emitEdge;
  const arrowFrom = pnp ? emitEdge : emitInner;
  const adx = arrowTarget.x - arrowFrom.x;
  const ady = arrowTarget.y - arrowFrom.y;
  const ad = Math.hypot(adx, ady) || 1;
  const ux = adx / ad;
  const uy = ady / ad;
  const tip = arrowTarget;
  const arrow = polygon(
    [
      tip,
      { x: tip.x - ux * 6 - (-uy) * 3, y: tip.y - uy * 6 - ux * 3 },
      { x: tip.x - ux * 6 + (-uy) * 3, y: tip.y - uy * 6 + ux * 3 },
    ],
    "wire-symbol-fill",
  );

  return [
    circle(center, radius, "wire-symbol-bg"),
    line(base, baseEdge, "wire-symbol"),
    line(barA, barB, "wire-symbol"),
    line(collEdge, collInner, "wire-symbol"),
    line(emitEdge, emitInner, "wire-symbol"),
    line(collector, collEdge, "wire-symbol"),
    line(emitter, emitEdge, "wire-symbol"),
    arrow,
  ].join("");
}

function drawModule(component: LayoutComponent): string {
  const { position, size } = component;
  const parts = [rect(position.x, position.y, size.width, size.height, "wire-symbol-bg")];
  for (const terminal of component.terminals) {
    const t = terminal.point;
    const inward =
      terminal.side === "left"
        ? { x: t.x + 8, y: t.y }
        : terminal.side === "right"
          ? { x: t.x - 8, y: t.y }
          : terminal.side === "top"
            ? { x: t.x, y: t.y + 8 }
            : { x: t.x, y: t.y - 8 };
    parts.push(line(t, inward, "wire-symbol"));
    const labelPoint =
      terminal.side === "bottom"
        ? { x: t.x, y: t.y - 11 }
        : terminal.side === "top"
          ? { x: t.x, y: t.y + 14 }
          : { x: inward.x, y: inward.y + 3 };
    parts.push(
      `<text class="wire-pin-label" x="${fmt(labelPoint.x)}" y="${fmt(labelPoint.y)}" text-anchor="middle">${escapeText(terminal.name)}</text>`,
    );
  }
  return parts.join("");
}

function drawTwoTerminal(component: LayoutComponent): string | null {
  const [t0, t1] = component.terminals;
  if (!t0 || !t1) return null;
  const { M, len } = makeFrame(t0.point, t1.point);
  switch (component.symbol) {
    case "resistor":
      return drawResistor(M, len);
    case "capacitor":
      return drawCapacitor(M, len, false);
    case "polarized-capacitor":
      return drawCapacitor(M, len, true);
    case "inductor":
      return drawInductor(M, len);
    case "diode":
      return drawDiode(M, len, component, false);
    case "led":
      return drawDiode(M, len, component, true);
    case "battery":
      return drawBattery(M, len);
    case "spst-switch":
      return drawSwitch(M, len, false);
    case "push-button":
      return drawSwitch(M, len, true);
    default:
      return null;
  }
}

function drawLabels(component: LayoutComponent): string {
  const parts: string[] = [];
  let y = component.position.y - 6;
  for (const label of component.labels) {
    if (label === "") continue;
    parts.push(
      `<text class="wire-label" x="${fmt(component.center.x)}" y="${fmt(y)}" text-anchor="middle">${escapeText(label)}</text>`,
    );
    y -= 13;
  }
  return parts.join("");
}

/** Render a component's glyph plus its default labels. */
export function renderComponent(component: LayoutComponent): string {
  let glyph: string | null;
  switch (component.symbol) {
    case "ground-reference":
      glyph = drawGround(component);
      break;
    case "npn-transistor":
      glyph = drawTransistor(component, false);
      break;
    case "pnp-transistor":
      glyph = drawTransistor(component, true);
      break;
    case "module":
      glyph = drawModule(component);
      break;
    default:
      glyph = drawTwoTerminal(component) ?? drawModule(component);
  }
  return `${glyph}${drawLabels(component)}`;
}
