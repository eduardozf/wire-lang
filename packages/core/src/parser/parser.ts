import type {
  AnnotationNode,
  AnnotationTargetNode,
  ComponentNode,
  ConnectNode,
  DefineComponentNode,
  DescriptionNode,
  DocumentNode,
  ErrorNode,
  GroupMemberNode,
  GroupNode,
  NetNode,
  NoConnectNode,
  PropertyNode,
  PropertyValueNode,
  RenderNode,
  StatementNode,
  SymbolDeclNode,
  SymbolMapNode,
  TerminalDeclNode,
  TerminalRefNode,
  TitleNode,
} from "../ast/nodes.js";
import type { Diagnostic, DiagnosticSeverity } from "../diagnostics.js";
import { DiagnosticCodes } from "../diagnostics.js";
import type { Position, SourceRange } from "../source.js";
import type { Token, TokenType } from "./tokenizer.js";
import { tokenize } from "./tokenizer.js";

export interface ParseResult {
  readonly ast: DocumentNode;
  readonly diagnostics: readonly Diagnostic[];
  /** True when there are no error-severity diagnostics. */
  readonly ok: boolean;
}

/** A name token may be an identifier word or a digit-leading token (e.g. `5V`). */
function isNameToken(token: Token): boolean {
  return token.type === "word" || token.type === "number";
}

class Parser {
  private pos = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(
    private readonly tokens: readonly Token[],
    private readonly source: string,
  ) {}

  parse(): ParseResult {
    const start = this.current().range.start;
    this.skipNewlines();

    if (this.current().type === "word" && this.current().value === "schematic") {
      this.next();
    } else {
      this.report(
        "error",
        DiagnosticCodes.parseMissingSchematic,
        'A Wire document must begin with the "schematic" document kind.',
        this.current().range,
      );
    }

    const statements: StatementNode[] = [];
    this.skipNewlines();
    while (this.current().type !== "eof") {
      const statement = this.parseStatement();
      if (statement) statements.push(statement);
      this.skipNewlines();
    }

    const end = this.tokens[this.tokens.length - 1]?.range.end ?? start;
    const ast: DocumentNode = { kind: "Document", statements, range: { start, end } };
    const ok = !this.diagnostics.some((diagnostic) => diagnostic.severity === "error");
    return { ast, diagnostics: this.diagnostics, ok };
  }

  // ---- token helpers -------------------------------------------------------

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
  }

  private peek(ahead: number): Token {
    return this.tokens[this.pos + ahead] ?? this.tokens[this.tokens.length - 1]!;
  }

  private next(): Token {
    const token = this.current();
    if (this.pos < this.tokens.length - 1) this.pos += 1;
    return token;
  }

  private skipNewlines(): void {
    while (this.current().type === "newline") this.next();
  }

  private atLineEnd(): boolean {
    const type = this.current().type;
    return type === "newline" || type === "eof";
  }

  private raw(range: SourceRange): string {
    return this.source.slice(range.start.offset, range.end.offset);
  }

  private report(
    severity: DiagnosticSeverity,
    code: string,
    message: string,
    range: SourceRange | null,
  ): void {
    this.diagnostics.push({ severity, code, message, range });
  }

  /** Consume the current token if it matches `type`, otherwise report an error. */
  private expect(type: TokenType, code: string, message: string): Token | null {
    if (this.current().type === type) return this.next();
    this.report("error", code, message, this.current().range);
    return null;
  }

  /** Skip any trailing tokens on the current line, warning if some are present. */
  private finishLine(): void {
    if (this.atLineEnd()) return;
    const start = this.current().range.start;
    let end = this.current().range.end;
    while (!this.atLineEnd()) {
      end = this.current().range.end;
      this.next();
    }
    this.report(
      "warning",
      DiagnosticCodes.parseUnexpectedToken,
      "Unexpected trailing input was ignored.",
      { start, end },
    );
  }

  /** Build an error node spanning from `start` to the end of the current line. */
  private errorLine(start: Position, message: string, code: string): ErrorNode {
    let end: Position = this.atLineEnd() ? this.current().range.start : this.current().range.end;
    while (!this.atLineEnd()) {
      end = this.current().range.end;
      this.next();
    }
    const range: SourceRange = { start, end };
    this.report("error", code, message, range);
    return { kind: "Error", message, raw: this.raw(range), range };
  }

  // ---- statements ----------------------------------------------------------

  private parseStatement(): StatementNode | null {
    const token = this.current();
    if (token.type !== "word") {
      return this.errorLine(
        token.range.start,
        "Expected a statement keyword.",
        DiagnosticCodes.parseUnknownStatement,
      );
    }
    // `no-connect` tokenizes as `no` `-` `connect`; recognize it before the
    // generic keyword switch so the hyphenated statement keyword still works.
    if (
      token.value === "no" &&
      this.peek(1).type === "minus" &&
      this.peek(2).type === "word" &&
      this.peek(2).value === "connect"
    ) {
      return this.parseNoConnect();
    }

    switch (token.value) {
      case "title":
        return this.parseTitle();
      case "description":
        return this.parseDescription();
      case "component":
        return this.parseComponent();
      case "define":
        return this.parseDefine();
      case "net":
        return this.parseNet();
      case "connect":
        return this.parseConnect();
      case "group":
        return this.parseGroup();
      case "annotation":
        return this.parseAnnotation();
      case "render":
        return this.parseRender();
      default:
        return this.errorLine(
          token.range.start,
          `Unknown statement "${token.value}".`,
          DiagnosticCodes.parseUnknownStatement,
        );
    }
  }

  private parseTitle(): TitleNode | ErrorNode {
    const start = this.next().range.start; // 'title'
    const str = this.expect(
      "string",
      DiagnosticCodes.parseExpectedString,
      "Expected a quoted title string.",
    );
    if (!str) return this.errorLine(start, "Malformed title.", DiagnosticCodes.parseExpectedString);
    const range: SourceRange = { start, end: str.range.end };
    this.finishLine();
    return { kind: "Title", value: str.value, range };
  }

  private parseDescription(): DescriptionNode | ErrorNode {
    const start = this.next().range.start; // 'description'
    const str = this.expect(
      "string",
      DiagnosticCodes.parseExpectedString,
      "Expected a quoted description string.",
    );
    if (!str)
      return this.errorLine(start, "Malformed description.", DiagnosticCodes.parseExpectedString);
    const range: SourceRange = { start, end: str.range.end };
    this.finishLine();
    return { kind: "Description", value: str.value, range };
  }

  private parseComponent(): ComponentNode | ErrorNode {
    const start = this.next().range.start; // 'component'
    const id = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a component instance id.",
    );
    if (!id)
      return this.errorLine(start, "Malformed component.", DiagnosticCodes.parseExpectedIdentifier);
    const type = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a component type name.",
    );
    if (!type)
      return this.errorLine(start, "Malformed component.", DiagnosticCodes.parseExpectedIdentifier);

    const properties: PropertyNode[] = [];
    while (this.current().type === "word") {
      const property = this.parseProperty();
      if (!property) break;
      properties.push(property);
    }

    const end = properties.at(-1)?.range.end ?? type.range.end;
    this.finishLine();
    return {
      kind: "Component",
      id: id.value,
      idRange: id.range,
      componentType: type.value,
      componentTypeRange: type.range,
      properties,
      range: { start, end },
    };
  }

  private parseProperty(): PropertyNode | null {
    const name = this.next(); // word
    if (
      !this.expect(
        "equals",
        DiagnosticCodes.parseUnexpectedToken,
        'Expected "=" after a property name.',
      )
    ) {
      return null;
    }
    const value = this.parsePropertyValue();
    return {
      kind: "Property",
      name: name.value,
      nameRange: name.range,
      value,
      range: { start: name.range.start, end: value.range.end },
    };
  }

  private parsePropertyValue(): PropertyValueNode {
    const token = this.current();
    if (token.type === "string") {
      this.next();
      return { kind: "PropertyValue", valueKind: "string", raw: token.value, range: token.range };
    }
    if (token.type === "number") {
      this.next();
      return { kind: "PropertyValue", valueKind: "quantity", raw: token.value, range: token.range };
    }
    if (token.type === "lbracket") {
      return this.parseListValue();
    }
    if (token.type === "word") {
      this.next();
      return { kind: "PropertyValue", valueKind: "word", raw: token.value, range: token.range };
    }
    this.report(
      "error",
      DiagnosticCodes.parseUnexpectedToken,
      "Expected a property value.",
      token.range,
    );
    return { kind: "PropertyValue", valueKind: "word", raw: "", range: token.range };
  }

  private parseListValue(): PropertyValueNode {
    const open = this.next(); // '['
    const items: string[] = [];
    // Each comma-separated item is captured as raw source text so structured
    // pin specs such as `1:VCC@left` survive tokenization; simple pin names
    // round-trip unchanged. Per-item semantics are validated in the compiler.
    while (!this.atLineEnd() && this.current().type !== "rbracket") {
      const itemStart = this.current().range.start;
      let itemEnd = itemStart;
      let sawToken = false;
      while (
        !this.atLineEnd() &&
        this.current().type !== "comma" &&
        this.current().type !== "rbracket"
      ) {
        itemEnd = this.current().range.end;
        this.next();
        sawToken = true;
      }
      if (sawToken) {
        const raw = this.source.slice(itemStart.offset, itemEnd.offset).trim();
        if (raw !== "") items.push(raw);
      }
      if (this.current().type === "comma") this.next();
    }
    let end = this.current().range.end;
    if (this.current().type === "rbracket") {
      this.next();
    } else {
      this.report(
        "error",
        DiagnosticCodes.parseUnexpectedToken,
        'Expected "]" to close the pin list.',
        this.current().range,
      );
      end = open.range.end;
    }
    const range: SourceRange = { start: open.range.start, end };
    return { kind: "PropertyValue", valueKind: "list", raw: this.raw(range), items, range };
  }

  private parseDefine(): DefineComponentNode | ErrorNode {
    const start = this.next().range.start; // 'define'
    if (!(this.current().type === "word" && this.current().value === "component")) {
      return this.errorLine(
        start,
        'Expected "component" after "define".',
        DiagnosticCodes.parseUnknownStatement,
      );
    }
    this.next(); // 'component'
    const name = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a component type name.",
    );
    if (!name)
      return this.errorLine(
        start,
        "Malformed definition.",
        DiagnosticCodes.parseExpectedIdentifier,
      );
    this.finishLine();

    const terminals: TerminalDeclNode[] = [];
    let symbol: SymbolDeclNode | null = null;
    let end = name.range.end;

    this.skipNewlines();
    while (true) {
      if (this.current().type === "eof") {
        this.report(
          "error",
          DiagnosticCodes.parseUnterminatedDefine,
          'Local component definition is missing its closing "end".',
          this.current().range,
        );
        break;
      }
      const token = this.current();
      if (token.type === "word" && token.value === "end") {
        end = this.next().range.end;
        break;
      }
      if (token.type === "word" && token.value === "terminal") {
        const decl = this.parseTerminalDecl();
        if (decl) {
          terminals.push(decl);
          end = decl.range.end;
        }
      } else if (token.type === "word" && token.value === "symbol") {
        symbol = this.parseSymbolDecl();
        end = symbol.range.end;
      } else {
        const error = this.errorLine(
          token.range.start,
          "Expected terminal, symbol, or end inside a definition.",
          DiagnosticCodes.parseUnknownStatement,
        );
        end = error.range.end;
      }
      this.skipNewlines();
    }

    return {
      kind: "DefineComponent",
      name: name.value,
      nameRange: name.range,
      terminals,
      symbol,
      range: { start, end },
    };
  }

  private parseTerminalDecl(): TerminalDeclNode | null {
    const start = this.next().range.start; // 'terminal'
    const name = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a terminal name.",
    );
    if (!name) return null;
    this.finishLine();
    return { kind: "TerminalDecl", name: name.value, range: { start, end: name.range.end } };
  }

  private parseSymbolDecl(): SymbolDeclNode {
    const start = this.next().range.start; // 'symbol'
    const symbolId = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a symbol id.",
    );
    const symbol = symbolId?.value ?? "module";
    let end = symbolId?.range.end ?? start;
    this.finishLine();

    const maps: SymbolMapNode[] = [];
    this.skipNewlines();
    while (this.current().type === "word" && this.current().value === "map") {
      const map = this.parseSymbolMap();
      if (map) {
        maps.push(map);
        end = map.range.end;
      }
      this.skipNewlines();
    }

    // A symbol block with role maps is closed by its own `end`.
    if (maps.length > 0 && this.current().type === "word" && this.current().value === "end") {
      end = this.next().range.end;
    }

    return { kind: "SymbolDecl", symbol, maps, range: { start, end } };
  }

  private parseSymbolMap(): SymbolMapNode | null {
    const start = this.next().range.start; // 'map'
    const role = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a symbol role name.",
    );
    if (!role) return null;
    if (
      !this.expect("equals", DiagnosticCodes.parseUnexpectedToken, 'Expected "=" in a role map.')
    ) {
      return null;
    }
    const terminal = this.parseTerminalName();
    if (!terminal) {
      this.report(
        "error",
        DiagnosticCodes.parseExpectedIdentifier,
        "Expected a terminal name in a role map.",
        this.current().range,
      );
      return null;
    }
    this.finishLine();
    return {
      kind: "SymbolMap",
      role: role.value,
      terminal: terminal.name,
      range: { start, end: terminal.range.end },
    };
  }

  private parseNet(): NetNode | ErrorNode {
    const start = this.next().range.start; // 'net'
    const name = this.current();
    if (!isNameToken(name)) {
      return this.errorLine(start, "Expected a net name.", DiagnosticCodes.parseExpectedIdentifier);
    }
    this.next();
    this.expect("colon", DiagnosticCodes.parseUnexpectedToken, 'Expected ":" after a net name.');
    const members = this.parseMemberList();
    const end = members.at(-1)?.range.end ?? name.range.end;
    this.finishLine();
    return {
      kind: "Net",
      name: name.value,
      nameRange: name.range,
      members,
      range: { start, end },
    };
  }

  private parseConnect(): ConnectNode | ErrorNode {
    const start = this.next().range.start; // 'connect'
    const members = this.parseMemberList();
    if (members.length === 0) {
      return this.errorLine(
        start,
        "Expected at least one terminal in a connect statement.",
        DiagnosticCodes.parseExpectedTerminalRef,
      );
    }
    const end = members.at(-1)?.range.end ?? start;
    this.finishLine();
    return { kind: "Connect", members, range: { start, end } };
  }

  private parseNoConnect(): NoConnectNode | ErrorNode {
    const start = this.next().range.start; // 'no'
    this.next(); // '-'
    this.next(); // 'connect'
    const members = this.parseMemberList();
    if (members.length === 0) {
      return this.errorLine(
        start,
        "Expected at least one terminal in a no-connect statement.",
        DiagnosticCodes.parseExpectedTerminalRef,
      );
    }
    const end = members.at(-1)?.range.end ?? start;
    this.finishLine();
    return { kind: "NoConnect", members, range: { start, end } };
  }

  private parseMemberList(): TerminalRefNode[] {
    const members: TerminalRefNode[] = [];
    const first = this.parseTerminalRef();
    if (!first) return members;
    members.push(first);
    while (this.current().type === "comma") {
      this.next();
      const ref = this.parseTerminalRef();
      if (!ref) break;
      members.push(ref);
    }
    return members;
  }

  private parseTerminalRef(): TerminalRefNode | null {
    const component = this.current();
    if (component.type !== "word") {
      this.report(
        "error",
        DiagnosticCodes.parseExpectedTerminalRef,
        "Expected a terminal reference like R1.1.",
        component.range,
      );
      return null;
    }
    this.next();
    if (
      !this.expect(
        "dot",
        DiagnosticCodes.parseExpectedTerminalRef,
        'Expected "." in a terminal reference.',
      )
    ) {
      return null;
    }
    const terminal = this.parseTerminalName();
    if (!terminal) {
      this.report(
        "error",
        DiagnosticCodes.parseExpectedTerminalRef,
        "Expected a terminal name after the dot.",
        this.current().range,
      );
      return null;
    }
    return {
      kind: "TerminalRef",
      component: component.value,
      componentRange: component.range,
      terminal: terminal.name,
      terminalRange: terminal.range,
      range: { start: component.range.start, end: terminal.range.end },
    };
  }

  private parseTerminalName(): { name: string; range: SourceRange } | null {
    const token = this.current();
    if (token.type === "word" || token.type === "number") {
      this.next();
      return { name: token.value, range: token.range };
    }
    if (token.type === "plus") {
      this.next();
      return { name: "+", range: token.range };
    }
    if (token.type === "minus") {
      this.next();
      return { name: "-", range: token.range };
    }
    return null;
  }

  private parseGroup(): GroupNode | ErrorNode {
    const start = this.next().range.start; // 'group'
    const name = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a group name.",
    );
    if (!name)
      return this.errorLine(start, "Malformed group.", DiagnosticCodes.parseExpectedIdentifier);
    this.expect("colon", DiagnosticCodes.parseUnexpectedToken, 'Expected ":" after a group name.');

    const members: GroupMemberNode[] = [];
    const readMember = (): boolean => {
      const token = this.current();
      if (token.type !== "word") return false;
      this.next();
      members.push({ kind: "GroupMember", id: token.value, range: token.range });
      return true;
    };
    if (readMember()) {
      while (this.current().type === "comma") {
        this.next();
        if (!readMember()) break;
      }
    }
    const end = members.at(-1)?.range.end ?? name.range.end;
    this.finishLine();
    return {
      kind: "Group",
      name: name.value,
      nameRange: name.range,
      members,
      range: { start, end },
    };
  }

  private parseAnnotation(): AnnotationNode | ErrorNode {
    const start = this.next().range.start; // 'annotation'
    const text = this.expect(
      "string",
      DiagnosticCodes.parseExpectedString,
      "Expected quoted annotation text.",
    );
    if (!text)
      return this.errorLine(start, "Malformed annotation.", DiagnosticCodes.parseExpectedString);

    let target: AnnotationTargetNode | null = null;
    if (this.current().type === "word" && this.current().value === "near") {
      this.next();
      target = this.parseAnnotationTarget();
    } else {
      this.report(
        "error",
        DiagnosticCodes.parseUnexpectedToken,
        'Expected "near TARGET" after annotation text.',
        this.current().range,
      );
    }
    const end = target?.range.end ?? text.range.end;
    this.finishLine();
    return { kind: "Annotation", text: text.value, target, range: { start, end } };
  }

  private parseAnnotationTarget(): AnnotationTargetNode | null {
    if (this.current().type === "word" && this.current().value === "net") {
      const start = this.next().range.start; // 'net'
      const name = this.current();
      if (!isNameToken(name)) {
        this.report(
          "error",
          DiagnosticCodes.parseExpectedIdentifier,
          "Expected a net name.",
          name.range,
        );
        return null;
      }
      this.next();
      return {
        kind: "AnnotationTarget",
        targetKind: "net",
        name: name.value,
        range: { start, end: name.range.end },
      };
    }
    const token = this.current();
    if (token.type !== "word") {
      this.report(
        "error",
        DiagnosticCodes.parseExpectedIdentifier,
        "Expected a component id or net target.",
        token.range,
      );
      return null;
    }
    this.next();
    return {
      kind: "AnnotationTarget",
      targetKind: "component",
      name: token.value,
      range: token.range,
    };
  }

  private parseRender(): RenderNode | ErrorNode {
    const start = this.next().range.start; // 'render'
    const head = this.current();

    // render net NAME key=value
    if (head.type === "word" && head.value === "net") {
      this.next();
      const netName = this.current();
      if (!isNameToken(netName)) {
        return this.errorLine(
          start,
          "Expected a net name.",
          DiagnosticCodes.parseExpectedIdentifier,
        );
      }
      this.next();
      const key = this.expect(
        "word",
        DiagnosticCodes.parseExpectedIdentifier,
        "Expected a render hint key.",
      );
      if (!key)
        return this.errorLine(
          start,
          "Malformed render hint.",
          DiagnosticCodes.parseExpectedIdentifier,
        );
      const equals = this.expect(
        "equals",
        DiagnosticCodes.parseUnexpectedToken,
        'Expected "=" in a render hint.',
      );
      if (!equals)
        return this.errorLine(
          start,
          "Malformed render hint.",
          DiagnosticCodes.parseUnexpectedToken,
        );
      const value = this.slurpHintValue(equals.range.end.offset);
      return {
        kind: "Render",
        scope: "net",
        target: netName.value,
        targetRange: netName.range,
        hintKey: key.value,
        hintValue: value.text,
        range: { start, end: value.end },
      };
    }

    if (!isNameToken(head)) {
      return this.errorLine(
        start,
        "Malformed render hint.",
        DiagnosticCodes.parseExpectedIdentifier,
      );
    }

    // render KEY=value  (global hint)
    if (this.peek(1).type === "equals") {
      this.next(); // key
      const equals = this.next(); // '='
      const value = this.slurpHintValue(equals.range.end.offset);
      return {
        kind: "Render",
        scope: "global",
        target: null,
        targetRange: null,
        hintKey: head.value,
        hintValue: value.text,
        range: { start, end: value.end },
      };
    }

    // render TARGET key=value  (targeted hint)
    this.next(); // target
    const key = this.expect(
      "word",
      DiagnosticCodes.parseExpectedIdentifier,
      "Expected a render hint key.",
    );
    if (!key)
      return this.errorLine(
        start,
        "Malformed render hint.",
        DiagnosticCodes.parseExpectedIdentifier,
      );
    const equals = this.expect(
      "equals",
      DiagnosticCodes.parseUnexpectedToken,
      'Expected "=" in a render hint.',
    );
    if (!equals)
      return this.errorLine(start, "Malformed render hint.", DiagnosticCodes.parseUnexpectedToken);
    const value = this.slurpHintValue(equals.range.end.offset);
    return {
      kind: "Render",
      scope: "target",
      target: head.value,
      targetRange: head.range,
      hintKey: key.value,
      hintValue: value.text,
      range: { start, end: value.end },
    };
  }

  /**
   * Capture a render-hint value as raw source from just after `=` to the end of
   * the line, then advance the token cursor past it. This preserves hyphenated
   * values like `left-to-right`.
   */
  private slurpHintValue(afterEqualsOffset: number): { text: string; end: Position } {
    let end: Position = this.current().range.start;
    while (!this.atLineEnd()) {
      end = this.current().range.end;
      this.next();
    }
    const text = this.source.slice(afterEqualsOffset, end.offset).trim();
    return { text, end };
  }
}

export function parseDocument(source: string): ParseResult {
  return new Parser(tokenize(source), source).parse();
}
