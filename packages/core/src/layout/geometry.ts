import type { ComponentInstance } from "../model/types.js";

/**
 * Local component geometry in (main, cross) space. `main` runs along the flow
 * axis (0 at the component's leading edge); `cross` is the perpendicular offset
 * from the body centerline (negative = one side, positive = the other).
 */
export interface TerminalGeom {
  readonly name: string;
  readonly main: number;
  readonly cross: number;
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

const GROUND_MAIN = 36;
const GROUND_CROSS = 30;

const MODULE_PIN_MAIN = 34;
const MODULE_MIN_MAIN = 64;
const MODULE_CROSS = 44;

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
]);

function roleTerminal(instance: ComponentInstance, role: string): string | undefined {
  return instance.roleMappings.find((mapping) => mapping.role === role)?.terminal;
}

export function componentGeometry(instance: ComponentInstance): ComponentGeom {
  const symbol = instance.symbol;

  if (symbol === "ground-reference") {
    const name = instance.terminals[0] ?? "GND";
    return {
      mainSpan: GROUND_MAIN,
      crossSpan: GROUND_CROSS,
      // Ground hangs below; its lead exits the top toward a rail.
      terminals: [{ name, main: GROUND_MAIN / 2, cross: -GROUND_CROSS / 2 }],
    };
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
