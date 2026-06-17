// Public API for @wire-lang/core.

export type {
  AnnotationNode,
  AnnotationTargetKind,
  AnnotationTargetNode,
  AstNode,
  ComponentNode,
  ConnectNode,
  DefineComponentNode,
  DescriptionNode,
  DocumentNode,
  ErrorNode,
  GroupMemberNode,
  GroupNode,
  NetNode,
  NodeBase,
  PropertyNode,
  PropertyValueKind,
  PropertyValueNode,
  RenderNode,
  RenderScope,
  StatementNode,
  SymbolDeclNode,
  SymbolMapNode,
  TerminalDeclNode,
  TerminalRefNode,
  TitleNode,
} from "./ast/nodes.js";
export { compile } from "./compiler/compile.js";
export type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  SuggestedFix,
} from "./diagnostics.js";
export { DiagnosticCodes, hasErrors } from "./diagnostics.js";
export { WireLangError } from "./errors.js";
export { layout } from "./layout/engine.js";
export type {
  LayoutComponent,
  LayoutLabel,
  LayoutModel,
  LayoutTerminal,
  LayoutWire,
  Point,
  Segment,
  Size,
  TerminalSide,
} from "./layout/types.js";

export type { Dimension, Quantity } from "./library/quantity.js";
export { parseQuantity } from "./library/quantity.js";
export { getStandardComponent, standardComponentNames } from "./library/standard-library.js";
export type {
  ComponentTypeDef,
  PropertyDef,
  PropertyKind,
  SymbolRoleMapping,
} from "./library/types.js";
export type {
  Annotation,
  CompileResult,
  ComponentInstance,
  Direction,
  Group,
  LocalComponentDef,
  Net,
  NetStyle,
  NetTerminalRef,
  NormalizedProperty,
  Orientation,
  SchematicModel,
  Side,
} from "./model/types.js";
export type { ParseResult } from "./parser/parser.js";
export { parseDocument as parse } from "./parser/parser.js";
export { renderSvg, serializeSvg } from "./render/render-svg.js";
export { renderComponent } from "./render/symbols.js";
export type { Position, SourceRange } from "./source.js";
