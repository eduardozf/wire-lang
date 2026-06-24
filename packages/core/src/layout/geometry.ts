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

// Single-terminal glyphs (ground, power flag, test point, antenna) hang off a
// short stub; the terminal exits one end toward a rail.
const SINGLE_TERM_MAIN = 36;
const SINGLE_TERM_CROSS = 30;

const MODULE_PIN_MAIN = 34;
const MODULE_MIN_MAIN = 64;
const MODULE_CROSS = 44;

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
  // bottom edge in declared order, preserving module pin order.
  const pins = instance.terminals;
  const count = Math.max(pins.length, 1);
  const mainSpan = Math.max(MODULE_MIN_MAIN, count * MODULE_PIN_MAIN);
  const terminals: TerminalGeom[] = pins.map((name, index) => ({
    name,
    main: ((index + 0.5) * mainSpan) / count,
    cross: MODULE_CROSS / 2,
  }));
  return { mainSpan, crossSpan: MODULE_CROSS, terminals };
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
  const horizCount = Math.max(bySide.top.length, bySide.bottom.length);
  const leftRight = bySide.left.length > 0 && bySide.right.length > 0;
  const topBottom = bySide.top.length > 0 && bySide.bottom.length > 0;
  // Pins on both opposite edges need room for two name labels between them.
  const boxMain = Math.max(
    IC_MIN_BOX,
    leftRight ? IC_OPPOSITE_MIN : 0,
    horizCount > 0 ? 2 * IC_PAD + (horizCount - 1) * IC_PIN_PITCH : 0,
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
  bySide.top.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "top",
      main: distribute(bySide.top.length, mainLo, mainHi, i),
      cross: -crossSpan / 2,
    });
  });
  bySide.bottom.forEach((pin, i) => {
    terminals.push({
      name: pin.name,
      number: pin.number,
      side: "bottom",
      main: distribute(bySide.bottom.length, mainLo, mainHi, i),
      cross: crossSpan / 2,
    });
  });

  return { mainSpan, crossSpan, terminals };
}
