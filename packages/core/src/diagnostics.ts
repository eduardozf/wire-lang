import type { SourceRange } from "./source.js";

export type DiagnosticSeverity = "error" | "warning";

/**
 * A high-confidence, mechanical source edit attached to a diagnostic. Suggested
 * fixes never invent circuit intent; they cover things like canonical
 * capitalization or alias replacement.
 */
export interface SuggestedFix {
  readonly description: string;
  readonly range: SourceRange;
  readonly replacement: string;
}

/**
 * A structured parser, validation, or normalization message. Tools should rely
 * on the stable {@link Diagnostic.code}; human-readable messages may evolve.
 */
export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly range: SourceRange | null;
  readonly fixes?: readonly SuggestedFix[];
}

export function isError(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === "error";
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some(isError);
}

/**
 * Stable diagnostic codes, grouped by area. The string values are the public
 * contract; do not change them without a deliberate version bump.
 */
export const DiagnosticCodes = {
  // parse
  parseMissingSchematic: "parse.missing-schematic",
  parseUnknownStatement: "parse.unknown-statement",
  parseUnexpectedToken: "parse.unexpected-token",
  parseExpectedString: "parse.expected-string",
  parseExpectedIdentifier: "parse.expected-identifier",
  parseExpectedTerminalRef: "parse.expected-terminal-ref",
  parseUnterminatedDefine: "parse.unterminated-define",

  // component
  componentUnknownType: "component.unknown-type",
  componentDuplicateId: "component.duplicate-id",
  componentMissingRecommendedProperty: "component.missing-recommended-property",
  componentUnknownProperty: "component.unknown-property",
  componentInvalidPropertyValue: "component.invalid-property-value",
  componentUnusualDesignator: "component.unusual-designator",

  // local definitions
  defineDuplicateTerminal: "define.duplicate-terminal",
  defineNoTerminals: "define.no-terminals",
  defineUnknownSymbol: "define.unknown-symbol",
  defineMissingSymbolRoleMap: "define.missing-symbol-role-map",
  defineUnknownRole: "define.unknown-role",
  defineUnknownMappedTerminal: "define.unknown-mapped-terminal",

  // net
  netConflict: "net.conflict",
  netFloating: "net.floating",
  netUnknownComponent: "net.unknown-component",
  netUnknownTerminal: "net.unknown-terminal",

  // group
  groupUnknownComponent: "group.unknown-component",
  groupDuplicateMembership: "group.duplicate-membership",
  groupIdCollision: "group.id-collision",
  /** Groups are accepted but the bundled renderer does not yet lay them out. */
  groupNotYetHonored: "group.not-yet-honored",

  // render
  renderUnknownTarget: "render.unknown-target",
  renderUnknownNet: "render.unknown-net",
  renderDuplicate: "render.duplicate",
  renderInvalidValue: "render.invalid-value",
  renderUnknownKey: "render.unknown-key",
  /** Hint is accepted but the bundled renderer does not yet position by it. */
  renderNotYetHonored: "render.not-yet-honored",

  // annotation
  annotationUnknownTarget: "annotation.unknown-target",

  // schematic
  schematicNoComponents: "schematic.no-components",
  schematicDisconnected: "schematic.disconnected-subschematics",
} as const;

export type DiagnosticCode = (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes];
