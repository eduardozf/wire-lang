import type { SymbolRoleMapping } from "../library/types.js";
import type { NormalizedProperty } from "../model/types.js";

/**
 * Renderer-independent layout model. Coordinates are abstract layout units with
 * the origin at the top-left; the SVG renderer scales them into pixels.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type TerminalSide = "left" | "right" | "top" | "bottom";

export interface LayoutTerminal {
  readonly name: string;
  readonly point: Point;
  readonly side: TerminalSide;
}

export interface LayoutComponent {
  readonly id: string;
  readonly typeName: string;
  readonly symbol: string;
  readonly position: Point; // top-left of the body box
  readonly size: Size;
  readonly center: Point;
  readonly terminals: readonly LayoutTerminal[];
  readonly labels: readonly string[];
  readonly roleMappings: readonly SymbolRoleMapping[];
  readonly properties: readonly NormalizedProperty[];
}

export interface Segment {
  readonly from: Point;
  readonly to: Point;
}

export interface LayoutWire {
  readonly net: string;
  readonly anonymous: boolean;
  readonly style: "wire" | "label";
  readonly segments: readonly Segment[];
  readonly junctions: readonly Point[];
}

export interface LayoutLabel {
  readonly text: string;
  readonly point: Point;
  readonly anchor: "start" | "middle" | "end";
  readonly kind: "annotation" | "net-label";
}

export interface LayoutModel {
  readonly size: Size;
  readonly components: readonly LayoutComponent[];
  readonly wires: readonly LayoutWire[];
  readonly labels: readonly LayoutLabel[];
  readonly title: string | null;
  readonly description: string | null;
}
