import type { Dimension } from "./quantity.js";

/**
 * Value kinds an electrical property can take. `quantity`, `string`, `boolean`,
 * and `enum` are the spec property kinds; `pin-list` is the structural kind used
 * by `Header`, whose terminals come from `pins=[...]`. `ic-pin-list` is the
 * richer structural kind used by `IC`, whose pins carry `number:name@side`.
 */
export type PropertyKind = "quantity" | "string" | "boolean" | "enum" | "pin-list" | "ic-pin-list";

export interface PropertyDef {
  readonly name: string;
  readonly kind: PropertyKind;
  /** Recommended properties produce a warning when missing, never an error. */
  readonly recommended?: boolean;
  /** Allowed values for `enum` properties. */
  readonly enumValues?: readonly string[];
  /** Physical dimension for `quantity` properties. */
  readonly dimension?: Dimension;
}

/** Maps a component terminal onto a role expected by its schematic symbol. */
export interface SymbolRoleMapping {
  readonly role: string;
  readonly terminal: string;
}

export interface ComponentTypeDef {
  readonly name: string;
  /** Canonical terminal names. Empty when {@link dynamicTerminals} is set. */
  readonly terminals: readonly string[];
  /** True for component types whose terminals are derived from a property (Header). */
  readonly dynamicTerminals?: boolean;
  readonly properties: readonly PropertyDef[];
  /** Property names (and the literal `id`) shown as labels by default. */
  readonly defaultLabels: readonly string[];
  /** Schematic symbol id used by the renderer. */
  readonly symbol: string;
  /** Terminal-role mappings; role names also act as terminal aliases. */
  readonly roleMappings?: readonly SymbolRoleMapping[];
  /** Accepted instance-id designator prefixes; mismatches warn, never error. */
  readonly designatorPrefixes?: readonly string[];
}

/**
 * Resolve a terminal reference name against a component type, accepting the
 * canonical terminal name or a symbol-role alias. Returns the canonical
 * terminal name, or `undefined` when unresolved.
 */
export function resolveTerminal(
  def: ComponentTypeDef,
  name: string,
  dynamicTerminals?: readonly string[],
): string | undefined {
  const terminals = def.dynamicTerminals ? (dynamicTerminals ?? []) : def.terminals;
  if (terminals.includes(name)) return name;
  const mapping = def.roleMappings?.find((entry) => entry.role === name);
  if (mapping && terminals.includes(mapping.terminal)) return mapping.terminal;
  return undefined;
}
