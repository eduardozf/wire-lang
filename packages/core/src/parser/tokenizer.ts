import type { Position, SourceRange } from "../source.js";

export type TokenType =
  | "word" // identifier: starts with a letter or underscore
  | "number" // quantity-ish: starts with a digit (e.g. 220ohm, 5V, 3V3, 10k)
  | "string" // "double quoted"
  | "colon"
  | "comma"
  | "equals"
  | "dot"
  | "lbracket"
  | "rbracket"
  | "plus"
  | "minus"
  | "newline"
  | "eof";

export interface Token {
  readonly type: TokenType;
  /** For strings, the unquoted content; otherwise the raw lexeme. */
  readonly value: string;
  readonly range: SourceRange;
}

const WORD_START = /[A-Za-z_]/;
const WORD_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
// Characters allowed inside a quantity-ish token after the leading digit.
const NUMBER_PART = /[0-9A-Za-z_.\u00b5\u03bc\u03a9\u2126]/;

interface Cursor {
  readonly source: string;
  offset: number;
  line: number;
  column: number;
}

function position(cursor: Cursor): Position {
  return { offset: cursor.offset, line: cursor.line, column: cursor.column };
}

function peek(cursor: Cursor, ahead = 0): string {
  return cursor.source[cursor.offset + ahead] ?? "";
}

function advance(cursor: Cursor): string {
  const ch = cursor.source[cursor.offset] ?? "";
  cursor.offset += 1;
  if (ch === "\n") {
    cursor.line += 1;
    cursor.column = 1;
  } else {
    cursor.column += 1;
  }
  return ch;
}

/**
 * Tokenize `.wire` source. Whitespace (other than newlines) and `//` line
 * comments are discarded. Consecutive blank lines collapse into a single
 * `newline` token. The stream always ends with an `eof` token.
 */
export function tokenize(source: string): Token[] {
  const cursor: Cursor = { source, offset: 0, line: 1, column: 1 };
  const tokens: Token[] = [];

  const single = (type: TokenType): void => {
    const start = position(cursor);
    const value = advance(cursor);
    tokens.push({ type, value, range: { start, end: position(cursor) } });
  };

  while (cursor.offset < source.length) {
    const ch = peek(cursor);

    // Spaces and tabs.
    if (ch === " " || ch === "\t" || ch === "\r") {
      advance(cursor);
      continue;
    }

    // Newlines: collapse runs (and intervening blank space) into one token.
    if (ch === "\n") {
      const start = position(cursor);
      advance(cursor);
      // Absorb following blank lines without emitting extra newline tokens.
      while (true) {
        const next = peek(cursor);
        if (next === " " || next === "\t" || next === "\r") {
          advance(cursor);
        } else if (next === "\n") {
          advance(cursor);
        } else {
          break;
        }
      }
      const last = tokens[tokens.length - 1];
      if (last && last.type !== "newline") {
        tokens.push({ type: "newline", value: "\n", range: { start, end: position(cursor) } });
      }
      continue;
    }

    // Line comments.
    if (ch === "/" && peek(cursor, 1) === "/") {
      while (cursor.offset < source.length && peek(cursor) !== "\n") {
        advance(cursor);
      }
      continue;
    }

    // Strings.
    if (ch === '"') {
      const start = position(cursor);
      advance(cursor); // opening quote
      let value = "";
      while (cursor.offset < source.length && peek(cursor) !== '"' && peek(cursor) !== "\n") {
        if (peek(cursor) === "\\" && (peek(cursor, 1) === '"' || peek(cursor, 1) === "\\")) {
          advance(cursor);
          value += advance(cursor);
        } else {
          value += advance(cursor);
        }
      }
      if (peek(cursor) === '"') advance(cursor); // closing quote
      tokens.push({ type: "string", value, range: { start, end: position(cursor) } });
      continue;
    }

    // Punctuation.
    switch (ch) {
      case ":":
        single("colon");
        continue;
      case ",":
        single("comma");
        continue;
      case "=":
        single("equals");
        continue;
      case ".":
        single("dot");
        continue;
      case "[":
        single("lbracket");
        continue;
      case "]":
        single("rbracket");
        continue;
      case "+":
        single("plus");
        continue;
      case "-":
        single("minus");
        continue;
      default:
        break;
    }

    // Words.
    if (WORD_START.test(ch)) {
      const start = position(cursor);
      let value = "";
      while (cursor.offset < source.length && WORD_PART.test(peek(cursor))) {
        value += advance(cursor);
      }
      tokens.push({ type: "word", value, range: { start, end: position(cursor) } });
      continue;
    }

    // Numbers / quantities.
    if (DIGIT.test(ch)) {
      const start = position(cursor);
      let value = "";
      while (cursor.offset < source.length && NUMBER_PART.test(peek(cursor))) {
        value += advance(cursor);
      }
      tokens.push({ type: "number", value, range: { start, end: position(cursor) } });
      continue;
    }

    // Unknown character: emit as a single-char word so the parser can report it.
    single("word");
  }

  tokens.push({
    type: "eof",
    value: "",
    range: { start: position(cursor), end: position(cursor) },
  });
  return tokens;
}
