import type { ComponentInstance } from "../model/types.js";
import type { TerminalSide } from "./types.js";

/**
 * Local component geometry in (main, cross) space. `main` runs along the flow
 * axis (0 at the component's leading edge); `cross` is the perpendicular offset
 * from the body centerline (negative = one side, positive = the other).
 */
export interface TerminalGeom {
  readonly name: string;
  readonly main: number;
  readonly cross: number;
  /** Explicit local-frame side; when absent the layout derives it from position. */
  readonly side?: TerminalSide;
  /** Pin number for IC-style components. */
  readonly number?: string | null;
}

export interface ComponentGeom {
  readonly mainSpan: number;
  readonly crossSpan: number;
  readonly terminals: readonly TerminalGeom[];
}

/**
 * Lead length: the straight wire stub between a terminal and the body. Layout
 * places the terminal this far out, and the renderer draws the lead to match;
 * they must agree, so both read this one constant.
 */
export const LEAD = 14;
const TWO_TERM_BODY = 36;
const TWO_TERM_MAIN = LEAD * 2 + TWO_TERM_BODY; // 64
const TWO_TERM_CROSS = 22;

const TRANSISTOR_MAIN = 54;
const TRANSISTOR_CROSS = 44;

// Potentiometer: a two-terminal resistor body whose wiper taps the midpoint on a
// perpendicular stub. The wiper sits this far off the body centerline; the cross
// span is symmetric around the body so the box encloses the tap on either flow.
const POT_WIPER_REACH = 24;

// Single-terminal glyphs (ground, power flag, test point, antenna) hang off a
// short stub; the terminal exits one end toward a rail.
const SINGLE_TERM_MAIN = 36;
const SINGLE_TERM_CROSS = 30;

const MODULE_PIN_MAIN = 34;
const MODULE_MIN_MAIN = 64;
const MODULE_CROSS = 44;

// Pin-name labels render horizontally along module/IC top and bottom edges, so
// the pitch between adjacent pins must fit both names or long ones (GPIO15)
// overlap. 5.6 ≈ one 9px monospace advance; layout has no text measurement.
const PIN_LABEL_CHAR_W = 5.6;
const PIN_LABEL_PAD = 6;

/** Pitch between two adjacent horizontal-label pins that fits both names. */
function labelPitch(a: string, b: string, minPitch: number): number {
  return Math.max(minPitch, ((a.length + b.length) / 2) * PIN_LABEL_CHAR_W + PIN_LABEL_PAD);
}

// IC block: pins stick out of a box on their declared side.
const IC_PIN_PITCH = 22; // spacing between adjacent pins on one side
/** Stub length reserved outside the IC box on every side; the renderer insets by this. */
export const IC_STUB = 14;
const IC_MIN_BOX = 44; // minimum inner box dimension
const IC_OPPOSITE_MIN = 76; // min box dimension when both opposite edges carry pins (room for two name labels)
const IC_PAD = 16; // gap from a box corner to the first pin on that side

const TWO_TERMINAL_SYMBOLS = new Set([
  "resistor",
  "capacitor",
  "polarized-capacitor",
  "inductor",
  "diode",
  "led",
  "zener-diode",
  "schottky-diode",
  "photodiode",
  "rheostat",
  "spst-switch",
  "push-button",
  "battery",
  "ferrite-bead",
  "tvs-diode",
  "speaker",
  "ptc",
]);

const SINGLE_TERMINAL_SYMBOLS = new Set([
  "ground-reference",
  "power-flag",
  "test-point",
  "antenna",
]);

/**
 * Symbols the layout may mirror to face a wire. Only two-terminal parts qualify:
 * their glyphs draw between the terminal points, so swapped terminals mirror the
 * drawing for free, and a reversed diode/LED/battery is legitimate schematic
 * practice. Modules and ICs draw from `side` and never mirror; transistors draw
 * from role positions and are excluded for the same reason.
 */
export const MIRRORABLE_SYMBOLS: ReadonlySet<string> = TWO_TERMINAL_SYMBOLS;

export function isTwoTerminalSymbol(symbol: string): boolean {
  return TWO_TERMINAL_SYMBOLS.has(symbol);
}

function roleTerminal(instance: ComponentInstance, role: string): string | undefined {
  return instance.roleMappings.find((mapping) => mapping.role === role)?.terminal;
}

export function componentGeometry(instance: ComponentInstance): ComponentGeom {
  const symbol = instance.symbol;

  if (SINGLE_TERMINAL_SYMBOLS.has(symbol)) {
    const name = instance.terminals[0] ?? "1";
    return {
      mainSpan: SINGLE_TERM_MAIN,
      crossSpan: SINGLE_TERM_CROSS,
      // The body hangs to one side; its lead exits the top toward a rail.
      terminals: [{ name, main: SINGLE_TERM_MAIN / 2, cross: -SINGLE_TERM_CROSS / 2 }],
    };
  }

  if (symbol === "ic") {
    return icGeometry(instance);
  }

  if (symbol === "npn-transistor" || symbol === "pnp-transistor") {
    const base = roleTerminal(instance, "base") ?? instance.terminals[1] ?? "B";
    const collector = roleTerminal(instance, "collector") ?? instance.terminals[0] ?? "C";
    const emitter = roleTerminal(instance, "emitter") ?? instance.terminals[2] ?? "E";
    return {
      mainSpan: TRANSISTOR_MAIN,
      crossSpan: TRANSISTOR_CROSS,
      terminals: [
        { name: base, main: 0, cross: 0 },
        { name: collector, main: TRANSISTOR_MAIN * 0.62, cross: -TRANSISTOR_CROSS / 2 },
        { name: emitter, main: TRANSISTOR_MAIN * 0.62, cross: TRANSISTOR_CROSS / 2 },
      ],
    };
  }

  if (symbol === "potentiometer") {
    // Body runs end-to-end like a resistor; the wiper taps the midpoint on a
    // perpendicular stub. Resolve the wiper by role so the two track ends keep
    // their declared order regardless of which terminal is the tap.
    const wiper = roleTerminal(instance, "wiper") ?? instance.terminals[1] ?? "W";
    const ends = instance.terminals.filter((name) => name !== wiper);
    const [a, b] = ends.length >= 2 ? ends : instance.terminals;
    return {
      mainSpan: TWO_TERM_MAIN,
      crossSpan: 2 * POT_WIPER_REACH,
      terminals: [
        { name: a ?? "1", main: 0, cross: 0 },
        { name: b ?? "2", main: TWO_TERM_MAIN, cross: 0 },
        { name: wiper, main: TWO_TERM_MAIN / 2, cross: -POT_WIPER_REACH },
      ],
    };
  }

  if (TWO_TERMINAL_SYMBOLS.has(symbol) && instance.terminals.length >= 2) {
    const [a, b] = instance.terminals;
    return {
      mainSpan: TWO_TERM_MAIN,
      crossSpan: TWO_TERM_CROSS,
      terminals: [
        { name: a ?? "1", main: 0, cross: 0 },
        { name: b ?? "2", main: TWO_TERM_MAIN, cross: 0 },
      ],
    };
  }

  // Module (Header, local modules) and any fallback: terminals spread along the
  // bottom edge in declared order, preserving module pin order. Each gap widens
  // past the base pitch when the two adjacent names need the room.
  const pins = instance.terminals.length > 0 ? instance.terminals : ["1"];
  const positions: number[] = [];
  let main = labelPitch(pins[0]!, pins[0]!, MODULE_PIN_MAIN) / 2;
  for (const [index, name] of pins.entries()) {
    if (index > 0) main += labelPitch(pins[index - 1]!, name, MODULE_PIN_MAIN);
    positions.push(main);
  }
  const natural =
    main + labelPitch(pins[pins.length - 1]!, pins[pins.length - 1]!, MODULE_PIN_MAIN) / 2;
  const mainSpan = Math.max(MODULE_MIN_MAIN, natural);
  const shift = (mainSpan - natural) / 2;
  const terminals: TerminalGeom[] = pins.map((name, index) => ({
    name,
    main: positions[index]! + shift,
    cross: MODULE_CROSS / 2,
  }));
  return { mainSpan, crossSpan: MODULE_CROSS, terminals };
}

/**
 * Rotate a local-frame side 90° in the same sense as {@link rotateGeometry}:
 * the `main` axis maps onto `cross`, so a leading-edge `left` pin becomes a
 * `top` pin, and so on. Reused by the flow engine to map a component's
 * local-frame side onto a vertical flow's swapped axes.
 */
export function rotateSide90(side: TerminalSide): TerminalSide {
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

/**
 * Rotate a component's geometry 90° about its body center. The `main` and `cross`
 * spans swap, each terminal's main-offset becomes a cross-offset (and vice
 * versa), and any explicit local-frame `side` rotates to match. Used to honor a
 * per-component `orientation` hint that runs against the flow's natural axis: a
 * resistor in a left-to-right flow is naturally horizontal, so `orientation=vertical`
 * rotates it. Because two-terminal symbols draw between their terminal points and
 * IC/module symbols draw from `side`, the renderer needs no further changes.
 */
export function rotateGeometry(geom: ComponentGeom): ComponentGeom {
  const { mainSpan, crossSpan } = geom;
  return {
    mainSpan: crossSpan,
    crossSpan: mainSpan,
    terminals: geom.terminals.map((terminal) => ({
      ...terminal,
      main: crossSpan / 2 + terminal.cross,
      cross: terminal.main - mainSpan / 2,
      side: terminal.side ? rotateSide90(terminal.side) : terminal.side,
    })),
  };
}

/**
 * Mirror a component's geometry across its body's cross-axis centerline: each
 * terminal's main-offset reflects (`main' = mainSpan - main`) and explicit
 * left/right sides swap; spans and cross-offsets are unchanged. Applying it
 * twice restores the original. Composes with {@link rotateGeometry}:
 * `rotateGeometry(mirrorGeometry(g))` yields a vertical part with the declared
 * second terminal on top, where `rotateGeometry(g)` puts the first on top.
 * Only meaningful for {@link MIRRORABLE_SYMBOLS}; see that set for why.
 */
export function mirrorGeometry(geom: ComponentGeom): ComponentGeom {
  const mirrorSide = (side: TerminalSide): TerminalSide =>
    side === "left" ? "right" : side === "right" ? "left" : side;
  return {
    mainSpan: geom.mainSpan,
    crossSpan: geom.crossSpan,
    terminals: geom.terminals.map((terminal) => ({
      ...terminal,
      main: geom.mainSpan - terminal.main,
      side: terminal.side ? mirrorSide(terminal.side) : terminal.side,
    })),
  };
}

/** Evenly place `count` items in `[lo, hi]`; a lone item sits at the midpoint. */
function distribute(count: number, lo: number, hi: number, index: number): number {
  if (count <= 1) return (lo + hi) / 2;
  return lo + ((hi - lo) * index) / (count - 1);
}

/**
 * IC block geometry: pins stick out of a rectangular box on their declared
 * side. A uniform stub margin is reserved on every side so the renderer can
 * inset the box from the bounding box regardless of flow direction.
 */
function icGeometry(instance: ComponentInstance): ComponentGeom {
  const pins =
    instance.pins && instance.pins.length > 0
      ? instance.pins
      : instance.terminals.map((name) => ({ number: null, name, side: "left" as const }));

  const bySide: Record<TerminalSide, { name: string; number: string | null }[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  for (const pin of pins) bySide[pin.side].push({ name: pin.name, number: pin.number });

  const vertCount = Math.max(bySide.left.length, bySide.right.length);
  const leftRight = bySide.left.length > 0 && bySide.right.length > 0;
  const topBottom = bySide.top.length > 0 && bySide.bottom.length > 0;
  // Top/bottom pins label horizontally, so their pitch is label-width-aware.
  const edgeRun = (edge: { name: string }[]): number => {
    let run = 0;
    for (let i = 1; i < edge.length; i++) {
      run += labelPitch(edge[i - 1]!.name, edge[i]!.name, IC_PIN_PITCH);
    }
    return run;
  };
  // Pins on both opposite edges need room for two name labels between them.
  const boxMain = Math.max(
    IC_MIN_BOX,
    leftRight ? IC_OPPOSITE_MIN : 0,
    bySide.top.length > 0 ? 2 * IC_PAD + edgeRun(bySide.top) : 0,
    bySide.bottom.length > 0 ? 2 * IC_PAD + edgeRun(bySide.bottom) : 0,
  );
  const boxCross = Math.max(
    IC_MIN_BOX,
    topBottom ? IC_OPPOSITE_MIN : 0,
    vertCount > 0 ? 2 * IC_PAD + (vertCount - 1) * IC_PIN_PITCH : 0,
  );
  const mainSpan = boxMain + 2 * IC_STUB;
  const crossSpan = boxCross + 2 * IC_STUB;

  const crossLo = -boxCross / 2 + IC_PAD;
  const crossHi = boxCross / 2 - IC_PAD;
  const mainLo = IC_STUB + IC_PAD;
  const mainHi = IC_STUB + boxMain - IC_PAD;

  const terminals: TerminalGeom[] = [];
  bySide.left.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "left",
      main: 0,
      cross: distribute(bySide.left.length, crossLo, crossHi, i),
    });
  });
  bySide.right.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "right",
      main: mainSpan,
      cross: distribute(bySide.right.length, crossLo, crossHi, i),
    });
  });
  // Horizontal-edge pins spread label-aware steps across the edge, stretched
  // to fill it (uniform names degrade to an even spread).
  const horizontalMains = (edge: { name: string }[]): number[] => {
    if (edge.length <= 1) return edge.map(() => (mainLo + mainHi) / 2);
    const steps = [0];
    for (let i = 1; i < edge.length; i++) {
      steps.push(steps[i - 1]! + labelPitch(edge[i - 1]!.name, edge[i]!.name, IC_PIN_PITCH));
    }
    const run = steps[steps.length - 1]!;
    return steps.map((step) => mainLo + (step * (mainHi - mainLo)) / run);
  };
  const topMains = horizontalMains(bySide.top);
  bySide.top.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "top",
      main: topMains[i]!,
      cross: -crossSpan / 2,
    });
  });
  const bottomMains = horizontalMains(bySide.bottom);
  bySide.bottom.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "bottom",
      main: bottomMains[i]!,
      cross: crossSpan / 2,
    });
  });

  return { mainSpan, crossSpan, terminals };
}
