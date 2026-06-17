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

export function rangeFrom(start: Position, end: Position): SourceRange {
  return { start, end };
}

/** Merge two ranges into the smallest range that covers both. */
export function spanRanges(a: SourceRange, b: SourceRange): SourceRange {
  const start = a.start.offset <= b.start.offset ? a.start : b.start;
  const end = a.end.offset >= b.end.offset ? a.end : b.end;
  return { start, end };
}
