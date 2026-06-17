import type { ComponentTypeDef } from "./types.js";

/**
 * The MVP standard component library. Each entry is the canonical definition of
 * a built-in component type: its terminals, properties, default labels, symbol,
 * and symbol-role mappings.
 */
const DEFINITIONS: readonly ComponentTypeDef[] = [
  {
    name: "Resistor",
    terminals: ["1", "2"],
    properties: [{ name: "value", kind: "quantity", dimension: "resistance", recommended: true }],
    defaultLabels: ["id", "value"],
    symbol: "resistor",
    designatorPrefixes: ["R"],
  },
  {
    name: "Capacitor",
    terminals: ["1", "2"],
    properties: [
      { name: "capacitance", kind: "quantity", dimension: "capacitance", recommended: true },
    ],
    defaultLabels: ["id", "capacitance"],
    symbol: "capacitor",
    designatorPrefixes: ["C"],
  },
  {
    name: "PolarizedCapacitor",
    terminals: ["+", "-"],
    properties: [
      { name: "capacitance", kind: "quantity", dimension: "capacitance", recommended: true },
    ],
    defaultLabels: ["id", "capacitance"],
    symbol: "polarized-capacitor",
    roleMappings: [
      { role: "positive", terminal: "+" },
      { role: "negative", terminal: "-" },
    ],
    designatorPrefixes: ["C"],
  },
  {
    name: "Inductor",
    terminals: ["1", "2"],
    properties: [
      { name: "inductance", kind: "quantity", dimension: "inductance", recommended: true },
    ],
    defaultLabels: ["id", "inductance"],
    symbol: "inductor",
    designatorPrefixes: ["L"],
  },
  {
    name: "Diode",
    terminals: ["A", "C"],
    properties: [],
    defaultLabels: ["id"],
    symbol: "diode",
    roleMappings: [
      { role: "anode", terminal: "A" },
      { role: "cathode", terminal: "C" },
    ],
    designatorPrefixes: ["D"],
  },
  {
    name: "LED",
    terminals: ["A", "C"],
    properties: [
      {
        name: "color",
        kind: "enum",
        enumValues: ["red", "green", "blue", "yellow", "white", "amber"],
      },
    ],
    defaultLabels: ["id"],
    symbol: "led",
    roleMappings: [
      { role: "anode", terminal: "A" },
      { role: "cathode", terminal: "C" },
    ],
    designatorPrefixes: ["D", "LED"],
  },
  {
    name: "NPNTransistor",
    terminals: ["C", "B", "E"],
    properties: [],
    defaultLabels: ["id"],
    symbol: "npn-transistor",
    roleMappings: [
      { role: "collector", terminal: "C" },
      { role: "base", terminal: "B" },
      { role: "emitter", terminal: "E" },
    ],
    designatorPrefixes: ["Q"],
  },
  {
    name: "PNPTransistor",
    terminals: ["C", "B", "E"],
    properties: [],
    defaultLabels: ["id"],
    symbol: "pnp-transistor",
    roleMappings: [
      { role: "collector", terminal: "C" },
      { role: "base", terminal: "B" },
      { role: "emitter", terminal: "E" },
    ],
    designatorPrefixes: ["Q"],
  },
  {
    name: "Battery",
    terminals: ["+", "-"],
    properties: [{ name: "voltage", kind: "quantity", dimension: "voltage", recommended: true }],
    defaultLabels: ["id", "voltage"],
    symbol: "battery",
    roleMappings: [
      { role: "positive", terminal: "+" },
      { role: "negative", terminal: "-" },
    ],
    designatorPrefixes: ["BT", "B"],
  },
  {
    name: "GroundReference",
    terminals: ["GND"],
    properties: [],
    defaultLabels: [],
    symbol: "ground-reference",
    roleMappings: [{ role: "reference", terminal: "GND" }],
    designatorPrefixes: ["G", "GND"],
  },
  {
    name: "SPSTSwitch",
    terminals: ["1", "2"],
    properties: [{ name: "state", kind: "enum", enumValues: ["open", "closed"] }],
    defaultLabels: ["id"],
    symbol: "spst-switch",
    designatorPrefixes: ["SW", "S"],
  },
  {
    name: "PushButton",
    terminals: ["1", "2"],
    properties: [{ name: "normally", kind: "enum", enumValues: ["open", "closed"] }],
    defaultLabels: ["id"],
    symbol: "push-button",
    designatorPrefixes: ["BTN", "SW", "S", "PB"],
  },
  {
    name: "Header",
    terminals: [],
    dynamicTerminals: true,
    properties: [{ name: "pins", kind: "pin-list", recommended: true }],
    defaultLabels: ["id"],
    symbol: "module",
    designatorPrefixes: ["J", "P", "CN", "H"],
  },
];

const BY_NAME: ReadonlyMap<string, ComponentTypeDef> = new Map(
  DEFINITIONS.map((definition) => [definition.name, definition]),
);

/** Look up a standard component type by its canonical (case-sensitive) name. */
export function getStandardComponent(name: string): ComponentTypeDef | undefined {
  return BY_NAME.get(name);
}

/** All standard component type names, in declaration order. */
export function standardComponentNames(): readonly string[] {
  return DEFINITIONS.map((definition) => definition.name);
}

export { DEFINITIONS as standardLibrary };
