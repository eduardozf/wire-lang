// Public API for @wire-lang/core.

export { parseDocument as parse } from "./parser/parser.js";
export type { ParseResult } from "./parser/parser.js";

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

export type { Diagnostic, DiagnosticSeverity, SuggestedFix } from "./diagnostics.js";
export { DiagnosticCodes, hasErrors } from "./diagnostics.js";
export type { DiagnosticCode } from "./diagnostics.js";

export type { Position, SourceRange } from "./source.js";

export { WireLangError } from "./errors.js";

export type { Dimension, Quantity } from "./library/quantity.js";
export { parseQuantity } from "./library/quantity.js";
export type { ComponentTypeDef, PropertyDef, PropertyKind, SymbolRoleMapping } from "./library/types.js";
export { getStandardComponent, standardComponentNames } from "./library/standard-library.js";

export { renderSvg } from "./render/render-svg.js";
export { serializeSvg } from "./render/render-svg.js";
export { renderComponent } from "./render/symbols.js";

export { layout } from "./layout/engine.js";
export type {
  LayoutComponent,
  LayoutLabel,
  LayoutModel,
  LayoutWire,
  Point,
  Segment,
  Size,
  TerminalSide,
  LayoutTerminal,
} from "./layout/types.js";

export { compile } from "./compiler/compile.js";
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
