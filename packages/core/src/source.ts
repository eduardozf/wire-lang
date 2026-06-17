/**
 * Source locations carried by public AST nodes and diagnostics.
 *
 * `line` and `column` are 1-based; `offset` is a 0-based character index into
 * the original UTF-16 source string.
 */
export interface Position {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceRange {
  readonly start: Position;
  readonly end: Position;
}
