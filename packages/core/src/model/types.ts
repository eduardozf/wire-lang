import type { Diagnostic } from "../diagnostics.js";
import type { Quantity } from "../library/quantity.js";
import type { ComponentTypeDef, SymbolRoleMapping } from "../library/types.js";

export type Direction = "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top";
export type Orientation = "horizontal" | "vertical";
export type Side = "left" | "right" | "top" | "bottom";
export type NetStyle = "wire" | "label";

export const DIRECTIONS: readonly Direction[] = [
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
];
export const ORIENTATIONS: readonly Orientation[] = ["horizontal", "vertical"];
export const SIDES: readonly Side[] = ["left", "right", "top", "bottom"];
export const NET_STYLES: readonly NetStyle[] = ["wire", "label"];

export type PropertyValueKind = "quantity" | "string" | "word" | "list";

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
  readonly components: readonly ComponentInstance[];
  readonly localDefinitions: readonly LocalComponentDef[];
  readonly nets: readonly Net[];
  readonly groups: readonly Group[];
  readonly annotations: readonly Annotation[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompileResult {
  readonly model: SchematicModel;
  readonly diagnostics: readonly Diagnostic[];
  /** True when there are no error-severity diagnostics. */
  readonly ok: boolean;
}

export const LANGUAGE_VERSION = "0.1.0";
