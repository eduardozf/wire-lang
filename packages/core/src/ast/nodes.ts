import type { SourceRange } from "../source.js";

/**
 * Public AST. This is the stable, renderer-independent syntax tree exposed by
 * {@link parse}. It is decoupled from any parser implementation. A partial AST
 * (produced from invalid source) may contain {@link ErrorNode}s in place of
 * statements that could not be parsed.
 */

export interface NodeBase {
  readonly range: SourceRange;
}

export interface DocumentNode extends NodeBase {
  readonly kind: "Document";
  readonly statements: readonly StatementNode[];
}

export type StatementNode =
  | TitleNode
  | DescriptionNode
  | ComponentNode
  | DefineComponentNode
  | NetNode
  | ConnectNode
  | GroupNode
  | AnnotationNode
  | RenderNode
  | ErrorNode;

export interface TitleNode extends NodeBase {
  readonly kind: "Title";
  readonly value: string;
}

export interface DescriptionNode extends NodeBase {
  readonly kind: "Description";
  readonly value: string;
}

export type PropertyValueKind = "quantity" | "string" | "word" | "list";

export interface PropertyValueNode extends NodeBase {
  readonly kind: "PropertyValue";
  readonly valueKind: PropertyValueKind;
  /** Raw textual value (for quantity/word/string). */
  readonly raw: string;
  /** List items (for `valueKind === "list"`). */
  readonly items?: readonly string[];
}

export interface PropertyNode extends NodeBase {
  readonly kind: "Property";
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly value: PropertyValueNode;
}

export interface ComponentNode extends NodeBase {
  readonly kind: "Component";
  readonly id: string;
  readonly idRange: SourceRange;
  readonly componentType: string;
  readonly componentTypeRange: SourceRange;
  readonly properties: readonly PropertyNode[];
}

export interface TerminalDeclNode extends NodeBase {
  readonly kind: "TerminalDecl";
  readonly name: string;
}

export interface SymbolMapNode extends NodeBase {
  readonly kind: "SymbolMap";
  readonly role: string;
  readonly terminal: string;
}

export interface SymbolDeclNode extends NodeBase {
  readonly kind: "SymbolDecl";
  readonly symbol: string;
  readonly maps: readonly SymbolMapNode[];
}

export interface DefineComponentNode extends NodeBase {
  readonly kind: "DefineComponent";
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly terminals: readonly TerminalDeclNode[];
  readonly symbol: SymbolDeclNode | null;
}

export interface TerminalRefNode extends NodeBase {
  readonly kind: "TerminalRef";
  readonly component: string;
  readonly componentRange: SourceRange;
  readonly terminal: string;
  readonly terminalRange: SourceRange;
}

export interface NetNode extends NodeBase {
  readonly kind: "Net";
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly members: readonly TerminalRefNode[];
}

export interface ConnectNode extends NodeBase {
  readonly kind: "Connect";
  readonly members: readonly TerminalRefNode[];
}

export interface GroupMemberNode extends NodeBase {
  readonly kind: "GroupMember";
  readonly id: string;
}

export interface GroupNode extends NodeBase {
  readonly kind: "Group";
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly members: readonly GroupMemberNode[];
}

export type AnnotationTargetKind = "component" | "net";

export interface AnnotationTargetNode extends NodeBase {
  readonly kind: "AnnotationTarget";
  readonly targetKind: AnnotationTargetKind;
  readonly name: string;
}

export interface AnnotationNode extends NodeBase {
  readonly kind: "Annotation";
  readonly text: string;
  readonly target: AnnotationTargetNode | null;
}

export type RenderScope = "global" | "target" | "net";

export interface RenderNode extends NodeBase {
  readonly kind: "Render";
  readonly scope: RenderScope;
  /** Target instance/group id or net name; `null` for global hints. */
  readonly target: string | null;
  readonly targetRange: SourceRange | null;
  readonly hintKey: string;
  readonly hintValue: string;
}

/** Placeholder for source text that could not be parsed into a valid statement. */
export interface ErrorNode extends NodeBase {
  readonly kind: "Error";
  readonly message: string;
  readonly raw: string;
}

export type AstNode =
  | DocumentNode
  | StatementNode
  | PropertyNode
  | PropertyValueNode
  | TerminalDeclNode
  | SymbolMapNode
  | SymbolDeclNode
  | TerminalRefNode
  | GroupMemberNode
  | AnnotationTargetNode;
