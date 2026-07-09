import { IC_STUB, LEAD } from "../layout/geometry.js";
import type { LayoutComponent, Point } from "../layout/types.js";
import {
  circle,
  escapeText,
  fmt,
  line,
  polygon,
  polylinePath,
  rect,
  text,
} from "./svg-serializer.js";

/**
 * How symbol geometry works
 * -------------------------
 * Every glyph is drawn in a *frame* attached to its component, so the same recipe
 * works wherever the layout places, rotates, or stretches the part. Positions are
 * written as labeled points `{ along, across }`:
 *
 *   - `along`  : distance from the first terminal (0) toward the second (`length`).
 *   - `across` : sideways offset from the axis. Negative is up, positive is down.
 *   - `center` : `length / 2`, the midpoint of the body along the axis.
 *   - `length` : the terminal-to-terminal distance.
 *   - `LEAD`   : length of the straight wire stub before the body starts.
 *
 * So `{ along: center + 7, across: -8 }` reads as "7 past the centre toward the
 * second terminal, then 8 up".
 *
 * A symbol is built by listing its parts with `pen(frame)`, whose verbs
 * (`lead`, `wire`, `bar`, `triangle`, `arrow`, `dot`, `circle`, `plus`) each take
 * one options object. `group(...)` joins the parts into the final SVG.
 */

/** A labeled point in a component's frame. */
interface Pt {
  readonly along: number;
  readonly across: number;
}

const LED_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  white: "#f3f4f6",
  amber: "#f59e0b",
};

/** Maps a labeled point in the local frame to an absolute SVG point. */
type Frame = (point: Pt) => Point;

function makeFrame(first: Point, second: Point): { frame: Frame; length: number } {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy) || 1;
  const axisX = dx / length;
  const axisY = dy / length;
  let sideX = -axisY; // unit vector across the axis (the "across" direction)
  let sideY = axisX;
  // Keep "across" pointing screen-down for horizontal axes and screen-left for
  // vertical ones, so a mirrored part (axis reversed) draws its decorations
  // (LED arrows, plungers, polarity marks) on the same side as an unmirrored one.
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal ? sideY < 0 : sideX > 0) {
    sideX = -sideX;
    sideY = -sideY;
  }
  const frame: Frame = ({ along, across }) => ({
    x: first.x + axisX * along + sideX * across,
    y: first.y + axisY * along + sideY * across,
  });
  return { frame, length };
}

/** Drawing verbs that take labeled points and named dimensions. */
interface Pen {
  /** A straight wire stub between two points (a component lead). */
  lead(options: { from: Pt; to: Pt }): string;
  /** An open polyline: resistor zig-zags, inductor coils, switch levers. */
  wire(options: { points: readonly Pt[] }): string;
  /** A straight stroke across the axis, centred on it: plates, cells, bars. */
  bar(options: { at: number; height: number }): string;
  /** An arbitrary straight stroke between two points. */
  segment(options: { from: Pt; to: Pt }): string;
  /** A filled triangle, e.g. the diode body. `fill` overrides the default. */
  triangle(options: { points: readonly Pt[]; fill?: string }): string;
  /** A shaft with an arrowhead that always points along the shaft. */
  arrow(options: { from: Pt; to: Pt }): string;
  /** A small filled contact dot. */
  dot(options: { at: Pt; radius?: number }): string;
  /** A stroked circle (e.g. a transistor envelope). */
  circle(options: { at: Pt; radius: number }): string;
  /** A "+" polarity marker. */
  plus(options: { at: Pt }): string;
}

function makePen(frame: Frame): Pen {
  return {
    lead: ({ from, to }) => polylinePath([frame(from), frame(to)], "wire-symbol"),
    wire: ({ points }) => polylinePath(points.map(frame), "wire-symbol"),
    bar: ({ at, height }) =>
      line(
        frame({ along: at, across: -height / 2 }),
        frame({ along: at, across: height / 2 }),
        "wire-symbol",
      ),
    segment: ({ from, to }) => line(frame(from), frame(to), "wire-symbol"),
    triangle: ({ points, fill }) =>
      polygon(points.map(frame), "wire-symbol-fill", fill ? ` fill="${fill}"` : ""),
    dot: ({ at, radius = 1.6 }) => circle(frame(at), radius, "wire-symbol-fill"),
    circle: ({ at, radius }) => circle(frame(at), radius, "wire-symbol-bg"),
    plus: ({ at }) => text("+", frame(at), "middle", "wire-pin-label"),
    arrow: ({ from, to }) => {
      const distance = Math.hypot(to.along - from.along, to.across - from.across) || 1;
      const axisX = (to.along - from.along) / distance;
      const axisY = (to.across - from.across) / distance;
      const headLength = 3.5;
      const headHalfWidth = 2.2;
      const base: Pt = {
        along: to.along - axisX * headLength,
        across: to.across - axisY * headLength,
      };
      const sideX = -axisY;
      const sideY = axisX;
      return (
        polylinePath([frame(from), frame(base)], "wire-symbol") +
        polygon(
          [
            frame(to),
            frame({
              along: base.along + sideX * headHalfWidth,
              across: base.across + sideY * headHalfWidth,
            }),
            frame({
              along: base.along - sideX * headHalfWidth,
              across: base.across - sideY * headHalfWidth,
            }),
          ],
          "wire-symbol-fill",
        )
      );
    },
  };
}

/** Join symbol parts into a single SVG fragment. */
function group(...parts: string[]): string {
  return parts.join("");
}

function ledColor(component: LayoutComponent): string | null {
  const color = component.properties.find((property) => property.name === "color")?.raw;
  return color ? (LED_COLORS[color] ?? null) : null;
}

function stringProp(component: LayoutComponent, name: string): string | null {
  return component.properties.find((property) => property.name === name)?.raw ?? null;
}

function boolProp(component: LayoutComponent, name: string): boolean {
  return stringProp(component, name) === "true";
}

function drawResistor(pen: Pen, length: number): string {
  const bodyStart = LEAD;
  const bodyEnd = length - LEAD;
  const bodySpan = bodyEnd - bodyStart;
  const toothCount = 6;
  const toothAmplitude = 7; // how far each tooth swings off the axis
  const points: Pt[] = [
    { along: 0, across: 0 },
    { along: bodyStart, across: 0 },
  ];
  for (let i = 0; i < toothCount; i += 1) {
    const along = bodyStart + (bodySpan * (i + 0.5)) / toothCount;
    points.push({ along, across: i % 2 === 0 ? -toothAmplitude : toothAmplitude });
  }
  points.push({ along: bodyEnd, across: 0 }, { along: length, across: 0 });
  return pen.wire({ points });
}

function drawCapacitor(pen: Pen, length: number, polarized: boolean): string {
  const center = length / 2;
  const plateGap = 3; // distance from the centre to each plate
  const plateHeight = 20; // plate height
  const parts = [
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - plateGap, across: 0 } }),
    pen.lead({ from: { along: center + plateGap, across: 0 }, to: { along: length, across: 0 } }),
    pen.bar({ at: center - plateGap, height: plateHeight }), // left plate
  ];
  if (polarized) {
    parts.push(
      // Curved "+" plate.
      pen.wire({
        points: [
          { along: center + plateGap, across: -8 },
          { along: center + plateGap + 3, across: -5 },
          { along: center + plateGap + 3, across: 5 },
          { along: center + plateGap, across: 8 },
        ],
      }),
      pen.plus({ at: { along: center - 8, across: -11 } }),
    );
  } else {
    parts.push(pen.bar({ at: center + plateGap, height: plateHeight })); // right plate
  }
  return group(...parts);
}

function drawInductor(pen: Pen, length: number): string {
  const bodyStart = LEAD;
  const bodyEnd = length - LEAD;
  const bumpCount = 4;
  const bumpWidth = (bodyEnd - bodyStart) / bumpCount;
  const bumpRadius = bumpWidth / 2;
  const points: Pt[] = [
    { along: 0, across: 0 },
    { along: bodyStart, across: 0 },
  ];
  for (let i = 0; i < bumpCount; i += 1) {
    const bumpCenter = bodyStart + (i + 0.5) * bumpWidth;
    for (let step = 0; step <= 8; step += 1) {
      const angle = Math.PI * (step / 8); // sweep each half-circle bump
      points.push({
        along: bumpCenter - bumpRadius * Math.cos(angle),
        across: -bumpRadius * Math.sin(angle),
      });
    }
  }
  points.push({ along: bodyEnd, across: 0 }, { along: length, across: 0 });
  return pen.wire({ points });
}

const DIODE_TIP = 7; // half-length of the body: flat anode at -tip, point at +tip
const DIODE_HEIGHT = 16; // height of the body and the cathode bar

/** Diode leads plus the filled triangle body, shared by every diode variant. */
function drawDiodeBody(pen: Pen, length: number, fill: string): string {
  const center = length / 2;
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - DIODE_TIP, across: 0 } }), // anode lead
    pen.lead({ from: { along: center + DIODE_TIP, across: 0 }, to: { along: length, across: 0 } }), // cathode lead
    pen.triangle({
      fill,
      points: [
        { along: center - DIODE_TIP, across: -DIODE_HEIGHT / 2 },
        { along: center - DIODE_TIP, across: DIODE_HEIGHT / 2 },
        { along: center + DIODE_TIP, across: 0 },
      ],
    }),
  );
}

function drawDiode(pen: Pen, length: number, component: LayoutComponent, led: boolean): string {
  const center = length / 2;
  const fill = led ? (ledColor(component) ?? "#9ca3af") : "#1f2937";
  const parts = [
    drawDiodeBody(pen, length, fill),
    pen.bar({ at: center + DIODE_TIP, height: DIODE_HEIGHT }), // straight cathode bar
  ];
  if (led) {
    // Two parallel "emitted light" arrows pointing away from the diode.
    parts.push(
      pen.arrow({ from: { along: center, across: -10 }, to: { along: center + 4, across: -16 } }),
      pen.arrow({
        from: { along: center + 4, across: -8 },
        to: { along: center + 8, across: -14 },
      }),
    );
  }
  return group(...parts);
}

function drawZenerDiode(pen: Pen, length: number): string {
  const center = length / 2;
  const bar = center + DIODE_TIP;
  const h = DIODE_HEIGHT / 2;
  // Canonical Zener cathode bar: a "Z" with the top end bent back toward the
  // anode and the bottom end bent forward toward the cathode. (A unidirectional
  // TVS shares this standard mark; the bidirectional TVS is the two-triangle form.)
  return group(
    drawDiodeBody(pen, length, "#1f2937"),
    pen.wire({
      points: [
        { along: bar - 4, across: -h },
        { along: bar, across: -h },
        { along: bar, across: h },
        { along: bar + 4, across: h },
      ],
    }),
  );
}

function drawSchottkyDiode(pen: Pen, length: number): string {
  const center = length / 2;
  const bar = center + DIODE_TIP;
  const h = DIODE_HEIGHT / 2;
  // Cathode bar with squared "S" hooks: a forward tick on top, a back tick below.
  return group(
    drawDiodeBody(pen, length, "#1f2937"),
    pen.wire({
      points: [
        { along: bar + 4, across: -h + 4 },
        { along: bar + 4, across: -h },
        { along: bar, across: -h },
        { along: bar, across: h },
        { along: bar - 4, across: h },
        { along: bar - 4, across: h - 4 },
      ],
    }),
  );
}

function drawPhotodiode(pen: Pen, length: number): string {
  const center = length / 2;
  // A plain diode plus two arrows pointing *into* the body (incident light),
  // the inverse of the LED's outward-emitting arrows.
  return group(
    drawDiodeBody(pen, length, "#1f2937"),
    pen.bar({ at: center + DIODE_TIP, height: DIODE_HEIGHT }),
    pen.arrow({ from: { along: center + 4, across: -16 }, to: { along: center, across: -10 } }),
    pen.arrow({ from: { along: center + 8, across: -14 }, to: { along: center + 4, across: -8 } }),
  );
}

function drawRheostat(pen: Pen, length: number): string {
  const center = length / 2;
  // A resistor body with a diagonal wiper arrow drawn across it.
  return group(
    drawResistor(pen, length),
    pen.arrow({
      from: { along: center - 12, across: 13 },
      to: { along: center + 12, across: -13 },
    }),
  );
}

function drawBattery(pen: Pen, length: number): string {
  const center = length / 2;
  const tallPlate = 22; // long cell plate height (the + terminal)
  const shortPlate = 12; // short cell plate height (the - terminal)
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - 7, across: 0 } }), // lead in
    pen.lead({ from: { along: center + 7, across: 0 }, to: { along: length, across: 0 } }), // lead out
    pen.bar({ at: center - 7, height: tallPlate }),
    pen.bar({ at: center - 3, height: shortPlate }),
    pen.bar({ at: center + 3, height: tallPlate }),
    pen.bar({ at: center + 7, height: shortPlate }),
  );
}

function drawSwitch(pen: Pen, length: number, pushButton: boolean): string {
  const center = length / 2;
  const contactGap = 8; // distance from the centre to each contact
  const parts = [
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - contactGap, across: 0 } }), // lead in
    pen.lead({ from: { along: center + contactGap, across: 0 }, to: { along: length, across: 0 } }), // lead out
    pen.dot({ at: { along: center - contactGap, across: 0 } }), // left contact
    pen.dot({ at: { along: center + contactGap, across: 0 } }), // right contact
  ];
  if (pushButton) {
    parts.push(
      // Horizontal contact plate above the contacts, plus the plunger.
      pen.segment({
        from: { along: center - contactGap, across: -11 },
        to: { along: center + contactGap, across: -11 },
      }),
      pen.wire({
        points: [
          { along: center, across: -11 },
          { along: center, across: -17 },
        ],
      }),
    );
  } else {
    parts.push(
      pen.wire({
        points: [
          { along: center - contactGap, across: 0 },
          { along: center + 7, across: -10 },
        ],
      }),
    ); // lever
  }
  return group(...parts);
}

function drawFerriteBead(pen: Pen, length: number): string {
  const center = length / 2;
  const halfWidth = 11; // half of the bead body along the axis
  const halfHeight = 7; // half of the bead body across the axis
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: length, across: 0 } }), // wire through
    pen.wire({
      points: [
        { along: center - halfWidth, across: -halfHeight },
        { along: center + halfWidth, across: -halfHeight },
        { along: center + halfWidth, across: halfHeight },
        { along: center - halfWidth, across: halfHeight },
        { along: center - halfWidth, across: -halfHeight },
      ],
    }),
  );
}

function drawTvsDiode(pen: Pen, length: number, component: LayoutComponent): string {
  const center = length / 2;
  const tip = 7; // half-length of each triangle body
  const height = 16; // body and bar height
  if (boolProp(component, "bidirectional")) {
    // Two opposing diodes sharing a central bar: conducts in both directions.
    return group(
      pen.lead({ from: { along: 0, across: 0 }, to: { along: center - tip - 3, across: 0 } }),
      pen.lead({ from: { along: center + tip + 3, across: 0 }, to: { along: length, across: 0 } }),
      pen.triangle({
        points: [
          { along: center - tip - 3, across: -height / 2 },
          { along: center - tip - 3, across: height / 2 },
          { along: center, across: 0 },
        ],
      }),
      pen.triangle({
        points: [
          { along: center + tip + 3, across: -height / 2 },
          { along: center + tip + 3, across: height / 2 },
          { along: center, across: 0 },
        ],
      }),
      pen.bar({ at: center, height }),
    );
  }
  // Unidirectional TVS: a diode with a bent cathode bar (transient-suppressor mark).
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - tip, across: 0 } }),
    pen.lead({ from: { along: center + tip, across: 0 }, to: { along: length, across: 0 } }),
    pen.triangle({
      points: [
        { along: center - tip, across: -height / 2 },
        { along: center - tip, across: height / 2 },
        { along: center + tip, across: 0 },
      ],
    }),
    pen.wire({
      points: [
        { along: center + tip - 4, across: -height / 2 },
        { along: center + tip, across: -height / 2 },
        { along: center + tip, across: height / 2 },
        { along: center + tip + 4, across: height / 2 },
      ],
    }),
  );
}

function drawSpeaker(pen: Pen, length: number): string {
  const center = length / 2;
  const coilHalf = 4; // half-width of the driver block along the axis
  const coilHeight = 18; // driver block height
  const coneReach = 11; // how far the cone mouth extends past the block
  const coneMouth = 28; // cone mouth height
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - coilHalf, across: 0 } }),
    pen.lead({
      from: { along: center + coilHalf + 11, across: 0 },
      to: { along: length, across: 0 },
    }),
    // Driver block (the coil/magnet).
    pen.wire({
      points: [
        { along: center - coilHalf, across: -coilHeight / 2 },
        { along: center + coilHalf, across: -coilHeight / 2 },
        { along: center + coilHalf, across: coilHeight / 2 },
        { along: center - coilHalf, across: coilHeight / 2 },
        { along: center - coilHalf, across: -coilHeight / 2 },
      ],
    }),
    // Cone mouth opening toward the second terminal.
    pen.wire({
      points: [
        { along: center + coilHalf, across: -coilHeight / 2 },
        { along: center + coilHalf + coneReach, across: -coneMouth / 2 },
        { along: center + coilHalf + coneReach, across: coneMouth / 2 },
        { along: center + coilHalf, across: coilHeight / 2 },
      ],
    }),
  );
}

function drawPtc(pen: Pen, length: number): string {
  const center = length / 2;
  const halfWidth = 13; // half of the body along the axis
  const halfHeight = 8; // half of the body across the axis
  return group(
    pen.lead({ from: { along: 0, across: 0 }, to: { along: center - halfWidth, across: 0 } }),
    pen.lead({ from: { along: center + halfWidth, across: 0 }, to: { along: length, across: 0 } }),
    pen.wire({
      points: [
        { along: center - halfWidth, across: -halfHeight },
        { along: center + halfWidth, across: -halfHeight },
        { along: center + halfWidth, across: halfHeight },
        { along: center - halfWidth, across: halfHeight },
        { along: center - halfWidth, across: -halfHeight },
      ],
    }),
    // Thermistor mark: a horizontal foot rising diagonally across the body.
    pen.wire({
      points: [
        { along: center - halfWidth + 3, across: halfHeight - 1 },
        { along: center - halfWidth + 7, across: halfHeight - 1 },
        { along: center + halfWidth - 3, across: -halfHeight + 1 },
      ],
    }),
  );
}

function drawGround(component: LayoutComponent): string {
  const terminal = component.terminals[0];
  if (!terminal) return "";
  // The ground glyph runs from its single terminal toward the body centre.
  const { frame, length } = makeFrame(terminal.point, component.center);
  const p = makePen(frame);
  return group(
    p.wire({
      points: [
        { along: 0, across: 0 },
        { along: length * 0.45, across: 0 },
      ],
    }), // stem
    p.bar({ at: length * 0.45, height: 24 }), // widest rail
    p.bar({ at: length * 0.68, height: 16 }),
    p.bar({ at: length * 0.9, height: 8 }),
  );
}

function drawPowerFlag(component: LayoutComponent): string {
  const terminal = component.terminals[0];
  if (!terminal) return "";
  const { frame, length } = makeFrame(terminal.point, component.center);
  const p = makePen(frame);
  const name = stringProp(component, "name") ?? "PWR";
  // An arrow pointing up the stem to the rail, with the rail name beneath it.
  const labelPoint = frame({ along: length * 1.9, across: 0 });
  return group(
    p.arrow({ from: { along: length * 1.5, across: 0 }, to: { along: 0, across: 0 } }),
    text(name, labelPoint, "middle", "wire-label"),
  );
}

function drawTestPoint(component: LayoutComponent): string {
  const terminal = component.terminals[0];
  if (!terminal) return "";
  const { frame, length } = makeFrame(terminal.point, component.center);
  const p = makePen(frame);
  return group(
    p.wire({
      points: [
        { along: 0, across: 0 },
        { along: length * 0.6, across: 0 },
      ],
    }), // stem
    p.circle({ at: { along: length * 0.85, across: 0 }, radius: 5 }), // probe ring
  );
}

function drawAntenna(component: LayoutComponent): string {
  const terminal = component.terminals[0];
  if (!terminal) return "";
  const { frame, length } = makeFrame(terminal.point, component.center);
  const p = makePen(frame);
  return group(
    p.wire({
      points: [
        { along: 0, across: 0 },
        { along: length * 0.5, across: 0 },
      ],
    }), // mast
    // Two rays fanning out from the top of the mast.
    p.segment({ from: { along: length * 0.5, across: 0 }, to: { along: length, across: -12 } }),
    p.segment({ from: { along: length * 0.5, across: 0 }, to: { along: length, across: 12 } }),
  );
}

function drawIc(component: LayoutComponent): string {
  const { position, size } = component;
  // The box is the bounding box inset by the stub margin reserved on every side.
  const boxX = position.x + IC_STUB;
  const boxY = position.y + IC_STUB;
  const boxW = size.width - 2 * IC_STUB;
  const boxH = size.height - 2 * IC_STUB;
  const parts = [rect(boxX, boxY, boxW, boxH, "wire-symbol-bg")];
  for (const terminal of component.terminals) {
    const t = terminal.point;
    let edge: Point;
    let namePoint: Point;
    let nameAnchor: "start" | "middle" | "end";
    let numberPoint: Point;
    let numberAnchor: "start" | "middle" | "end";
    switch (terminal.side) {
      case "left":
        edge = { x: boxX, y: t.y };
        namePoint = { x: boxX + 6, y: t.y + 3 };
        nameAnchor = "start";
        numberPoint = { x: boxX - 4, y: t.y - 4 };
        numberAnchor = "end";
        break;
      case "right":
        edge = { x: boxX + boxW, y: t.y };
        namePoint = { x: boxX + boxW - 6, y: t.y + 3 };
        nameAnchor = "end";
        numberPoint = { x: boxX + boxW + 4, y: t.y - 4 };
        numberAnchor = "start";
        break;
      case "top":
        edge = { x: t.x, y: boxY };
        namePoint = { x: t.x, y: boxY + 12 };
        nameAnchor = "middle";
        numberPoint = { x: t.x + 4, y: boxY - 5 };
        numberAnchor = "start";
        break;
      default:
        edge = { x: t.x, y: boxY + boxH };
        namePoint = { x: t.x, y: boxY + boxH - 7 };
        nameAnchor = "middle";
        numberPoint = { x: t.x + 4, y: boxY + boxH + 11 };
        numberAnchor = "start";
        break;
    }
    parts.push(line(t, edge, "wire-symbol"));
    parts.push(text(terminal.name, namePoint, nameAnchor, "wire-pin-label"));
    if (terminal.number != null && terminal.number !== "") {
      parts.push(text(terminal.number, numberPoint, numberAnchor, "wire-pin-label"));
    }
  }
  return parts.join("");
}

function boundaryPoint(from: Point, to: Point, radius: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { x: to.x - (dx / distance) * radius, y: to.y - (dy / distance) * radius };
}

function drawTransistor(component: LayoutComponent, pnp: boolean): string {
  // The transistor is drawn in absolute coordinates: its geometry is radial
  // (an envelope circle with three leads at arbitrary angles), which the 1-D
  // along/across frame used by the other symbols cannot express naturally.
  const center = component.center;
  const radius = 17; // envelope circle
  const baseBarHalfLength = 9; // half-length of the base bar
  const baseBarInset = 0.45; // base bar sits this fraction of the radius inside the edge
  const legSpread = 5; // collector/emitter contact offset from the bar centre
  const arrowLength = 6;
  const arrowHalfWidth = 3;

  const byRole = (role: string): Point | null => {
    const name = component.roleMappings.find((mapping) => mapping.role === role)?.terminal;
    const terminal = component.terminals.find((entry) => entry.name === name);
    return terminal ? terminal.point : null;
  };
  const base = byRole("base") ?? component.terminals[0]?.point ?? center;
  const collector = byRole("collector") ?? component.terminals[1]?.point ?? center;
  const emitter = byRole("emitter") ?? component.terminals[2]?.point ?? center;

  const baseEdge = boundaryPoint(center, base, radius);
  // Unit vector from the centre toward the base lead, plus its left normal.
  const baseDx = baseEdge.x - center.x;
  const baseDy = baseEdge.y - center.y;
  const baseDistance = Math.hypot(baseDx, baseDy) || 1;
  const towardBaseX = baseDx / baseDistance;
  const towardBaseY = baseDy / baseDistance;
  const normalX = -towardBaseY;
  const normalY = towardBaseX;

  // Base bar sits just inside the envelope, perpendicular to the base lead.
  const barCenter = {
    x: center.x - towardBaseX * (radius * baseBarInset),
    y: center.y - towardBaseY * (radius * baseBarInset),
  };
  const barA = {
    x: barCenter.x + normalX * baseBarHalfLength,
    y: barCenter.y + normalY * baseBarHalfLength,
  };
  const barB = {
    x: barCenter.x - normalX * baseBarHalfLength,
    y: barCenter.y - normalY * baseBarHalfLength,
  };
  const collectorInner = {
    x: barCenter.x + normalX * legSpread,
    y: barCenter.y + normalY * legSpread,
  };
  const emitterInner = {
    x: barCenter.x - normalX * legSpread,
    y: barCenter.y - normalY * legSpread,
  };
  const collectorEdge = boundaryPoint(center, collector, radius);
  const emitterEdge = boundaryPoint(center, emitter, radius);

  // The emitter leg carries the arrow: inward for PNP, outward for NPN.
  const tip = pnp ? emitterInner : emitterEdge;
  const arrowFrom = pnp ? emitterEdge : emitterInner;
  const arrowDx = tip.x - arrowFrom.x;
  const arrowDy = tip.y - arrowFrom.y;
  const arrowDistance = Math.hypot(arrowDx, arrowDy) || 1;
  const arrowAxisX = arrowDx / arrowDistance;
  const arrowAxisY = arrowDy / arrowDistance;
  const arrow = polygon(
    [
      tip,
      {
        x: tip.x - arrowAxisX * arrowLength - -arrowAxisY * arrowHalfWidth,
        y: tip.y - arrowAxisY * arrowLength - arrowAxisX * arrowHalfWidth,
      },
      {
        x: tip.x - arrowAxisX * arrowLength + -arrowAxisY * arrowHalfWidth,
        y: tip.y - arrowAxisY * arrowLength + arrowAxisX * arrowHalfWidth,
      },
    ],
    "wire-symbol-fill",
  );

  return group(
    circle(center, radius, "wire-symbol-bg"),
    line(base, baseEdge, "wire-symbol"),
    line(barA, barB, "wire-symbol"),
    line(collectorEdge, collectorInner, "wire-symbol"),
    line(emitterEdge, emitterInner, "wire-symbol"),
    line(collector, collectorEdge, "wire-symbol"),
    line(emitter, emitterEdge, "wire-symbol"),
    arrow,
  );
}

function drawModule(component: LayoutComponent): string {
  const { position, size } = component;
  const stubLength = 8; // length of each terminal stub
  const sideLabelDrop = 3; // how far a side label sits below the stub
  const topLabelDrop = 14; // vertical offset for a top-side label
  const bottomLabelRise = 11; // vertical offset for a bottom-side label
  const parts = [rect(position.x, position.y, size.width, size.height, "wire-symbol-bg")];
  for (const terminal of component.terminals) {
    const t = terminal.point;
    const inward =
      terminal.side === "left"
        ? { x: t.x + stubLength, y: t.y }
        : terminal.side === "right"
          ? { x: t.x - stubLength, y: t.y }
          : terminal.side === "top"
            ? { x: t.x, y: t.y + stubLength }
            : { x: t.x, y: t.y - stubLength };
    parts.push(line(t, inward, "wire-symbol"));
    const labelPoint =
      terminal.side === "bottom"
        ? { x: t.x, y: t.y - bottomLabelRise }
        : terminal.side === "top"
          ? { x: t.x, y: t.y + topLabelDrop }
          : { x: inward.x, y: inward.y + sideLabelDrop };
    parts.push(
      `<text class="wire-pin-label" x="${fmt(labelPoint.x)}" y="${fmt(labelPoint.y)}" text-anchor="middle">${escapeText(terminal.name)}</text>`,
    );
  }
  return parts.join("");
}

function drawPotentiometer(component: LayoutComponent): string {
  // The body is a resistor between the two track ends; the wiper taps the
  // midpoint with an arrow. Resolve the wiper by role, then draw the body in the
  // end-to-end frame and the arrow in a fresh frame from the wiper to the body.
  const wiperName = component.roleMappings.find((mapping) => mapping.role === "wiper")?.terminal;
  const wiper =
    component.terminals.find((terminal) => terminal.name === wiperName) ?? component.terminals[1];
  const ends = component.terminals.filter((terminal) => terminal !== wiper);
  const [a, b] = ends.length >= 2 ? ends : component.terminals;
  if (!a || !b) return "";
  const { frame, length } = makeFrame(a.point, b.point);
  const body = drawResistor(makePen(frame), length);
  if (!wiper) return body;
  const bodyCenter = frame({ along: length / 2, across: 0 });
  const { frame: wiperFrame, length: wiperLength } = makeFrame(wiper.point, bodyCenter);
  const arrow = makePen(wiperFrame).arrow({
    from: { along: 0, across: 0 },
    to: { along: Math.max(wiperLength - 9, wiperLength * 0.6), across: 0 },
  });
  return group(body, arrow);
}

function drawTwoTerminal(component: LayoutComponent): string | null {
  const [first, second] = component.terminals;
  if (!first || !second) return null;
  const { frame, length } = makeFrame(first.point, second.point);
  const p = makePen(frame);
  switch (component.symbol) {
    case "resistor":
      return drawResistor(p, length);
    case "capacitor":
      return drawCapacitor(p, length, false);
    case "polarized-capacitor":
      return drawCapacitor(p, length, true);
    case "inductor":
      return drawInductor(p, length);
    case "diode":
      return drawDiode(p, length, component, false);
    case "led":
      return drawDiode(p, length, component, true);
    case "zener-diode":
      return drawZenerDiode(p, length);
    case "schottky-diode":
      return drawSchottkyDiode(p, length);
    case "photodiode":
      return drawPhotodiode(p, length);
    case "rheostat":
      return drawRheostat(p, length);
    case "battery":
      return drawBattery(p, length);
    case "spst-switch":
      return drawSwitch(p, length, false);
    case "push-button":
      return drawSwitch(p, length, true);
    case "ferrite-bead":
      return drawFerriteBead(p, length);
    case "tvs-diode":
      return drawTvsDiode(p, length, component);
    case "speaker":
      return drawSpeaker(p, length);
    case "ptc":
      return drawPtc(p, length);
    default:
      return null;
  }
}

function drawLabels(component: LayoutComponent): string {
  const labels = component.labels.filter((label) => label !== "");
  if (labels.length === 0) return "";
  const parts: string[] = [];
  // A vertical two-terminal part has wires entering top and bottom, so labels
  // above would sit in the wire's path; put them beside the body instead.
  const [first, second] = component.terminals;
  const vertical =
    component.terminals.length === 2 &&
    first &&
    second &&
    Math.abs(second.point.y - first.point.y) > Math.abs(second.point.x - first.point.x);
  if (vertical) {
    const x = component.position.x + component.size.width + 6;
    let y = component.center.y + 4 - ((labels.length - 1) * 13) / 2;
    for (const label of labels) {
      parts.push(
        `<text class="wire-label" x="${fmt(x)}" y="${fmt(y)}" text-anchor="start">${escapeText(label)}</text>`,
      );
      y += 13;
    }
    return parts.join("");
  }
  let y = component.position.y - 6;
  for (const label of labels) {
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
    case "power-flag":
      glyph = drawPowerFlag(component);
      break;
    case "test-point":
      glyph = drawTestPoint(component);
      break;
    case "antenna":
      glyph = drawAntenna(component);
      break;
    case "npn-transistor":
      glyph = drawTransistor(component, false);
      break;
    case "pnp-transistor":
      glyph = drawTransistor(component, true);
      break;
    case "potentiometer":
      glyph = drawPotentiometer(component);
      break;
    case "ic":
      glyph = drawIc(component);
      break;
    case "module":
      glyph = drawModule(component);
      break;
    default:
      glyph = drawTwoTerminal(component) ?? drawModule(component);
  }
  return `${glyph}${drawLabels(component)}`;
}
