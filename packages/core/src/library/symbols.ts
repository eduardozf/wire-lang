/**
 * Semantic role requirements per schematic symbol. A local component definition
 * that adopts a built-in symbol with required roles must map each role to one of
 * its terminals.
 */
const SYMBOL_REQUIRED_ROLES: Record<string, readonly string[]> = {
  resistor: [],
  capacitor: [],
  "polarized-capacitor": ["positive", "negative"],
  inductor: [],
  diode: ["anode", "cathode"],
  led: ["anode", "cathode"],
  "npn-transistor": ["collector", "base", "emitter"],
  "pnp-transistor": ["collector", "base", "emitter"],
  battery: ["positive", "negative"],
  "ground-reference": ["reference"],
  "spst-switch": [],
  "push-button": [],
  module: [],
};

export function requiredSymbolRoles(symbol: string): readonly string[] {
  return SYMBOL_REQUIRED_ROLES[symbol] ?? [];
}

export function isKnownSymbol(symbol: string): boolean {
  return Object.hasOwn(SYMBOL_REQUIRED_ROLES, symbol);
}
