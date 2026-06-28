import type { PropertyValueKind } from "../ast/nodes.js";
import type { Diagnostic } from "../diagnostics.js";
import type { Quantity } from "../library/quantity.js";
import type { ComponentTypeDef, SymbolRoleMapping } from "../library/types.js";

export type { PropertyValueKind };

export type Direction = "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top";
export type Orientation = "horizontal" | "vertical";
export type Side = "left" | "right" | "top" | "bottom";
export type NetStyle = "wire" | "label";
/** How visual wires that cross without a junction are drawn. */
export type CrossingStyle = "gap" | "hop";
/**
 * Layout strategy. `flow` is the default row-of-components engine; `bus-rail`
 * arranges a central hub with peripherals between a top supply rail and a bottom
 * ground rail, bundling grouped signals into color-coded bus trunks.
 */
export type LayoutMode = "flow" | "bus-rail";

export const DIRECTIONS: readonly Direction[] = [
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
];
export const ORIENTATIONS: readonly Orientation[] = ["horizontal", "vertical"];
export const SIDES: readonly Side[] = ["left", "right", "top", "bottom"];
export const NET_STYLES: readonly NetStyle[] = ["wire", "label"];
export const CROSSING_STYLES: readonly CrossingStyle[] = ["gap", "hop"];
export const LAYOUT_MODES: readonly LayoutMode[] = ["flow", "bus-rail"];

/**
 * A pin on an `IC` block: an optional pin number, the terminal name, and the
 * box edge it sits on. Derived from `pins=[number:name@side, ...]`.
 */
export interface IcPin {
  readonly number: string | null;
  readonly name: string;
  readonly side: Side;
}

export interface NormalizedProperty {
  readonly name: string;
  readonly valueKind: PropertyValueKind;
  /** Original source text. */
  readonly raw: string;
  /** Human-facing label text (defaults to the original text). */
  readonly display: string;
  /** Present for normalized unit-bearing properties. */
  readonly quantity?: Quantity;
  /** Present for `list` values such as `Header` pins. */
  readonly items?: readonly string[];
  /** Whether the component type declares this property. */
  readonly known: boolean;
}

export interface ComponentInstance {
  readonly id: string;
  readonly typeName: string;
  /** Resolved type definition, or null when the type could not be resolved. */
  readonly type: ComponentTypeDef | null;
  /** Resolved terminal names (includes Header pins). */
  readonly terminals: readonly string[];
  readonly properties: readonly NormalizedProperty[];
  /** Default labels resolved to display strings. */
  readonly labels: readonly string[];
  readonly group: string | null;
  /** True when the type came from a local definition. */
  readonly local: boolean;
  readonly symbol: string;
  readonly roleMappings: readonly SymbolRoleMapping[];
  /** Structured pin layout for `IC` blocks; absent for other component types. */
  readonly pins?: readonly IcPin[];
  readonly sourceIndex: number;
  // Resolved render hints:
  readonly orientation: Orientation | null;
  readonly side: Side | null;
  readonly anchorCenter: boolean;
}

export interface LocalComponentDef {
  readonly name: string;
  readonly terminals: readonly string[];
  readonly symbol: string;
  readonly roleMappings: readonly SymbolRoleMapping[];
}

export interface NetTerminalRef {
  readonly component: string;
  readonly terminal: string;
}

export interface Net {
  /** Named nets use their source name; anonymous nets get a generated id. */
  readonly name: string;
  readonly anonymous: boolean;
  readonly members: readonly NetTerminalRef[];
  readonly style: NetStyle;
  readonly sourceIndex: number;
}

/** A terminal marked as intentionally unconnected with `no-connect`. */
export interface NoConnect {
  readonly component: string;
  readonly terminal: string;
}

export interface Annotation {
  readonly text: string;
  readonly targetKind: "component" | "net";
  readonly target: string;
}

export interface Group {
  readonly name: string;
  readonly members: readonly string[];
  readonly side: Side | null;
}

export interface SchematicModel {
  readonly title: string | null;
  readonly description: string | null;
  readonly languageVersion: string;
  readonly direction: Direction;
  /** How non-junction wire crossings are drawn (`gap` by default). */
  readonly crossings: CrossingStyle;
  /** Layout strategy (`flow` by default). */
  readonly layout: LayoutMode;
  readonly components: readonly ComponentInstance[];
  readonly localDefinitions: readonly LocalComponentDef[];
  readonly nets: readonly Net[];
  readonly groups: readonly Group[];
  readonly annotations: readonly Annotation[];
  readonly noConnects: readonly NoConnect[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompileResult {
  readonly model: SchematicModel;
  readonly diagnostics: readonly Diagnostic[];
  /** True when there are no error-severity diagnostics. */
  readonly ok: boolean;
}

export const LANGUAGE_VERSION = "0.2.0";
