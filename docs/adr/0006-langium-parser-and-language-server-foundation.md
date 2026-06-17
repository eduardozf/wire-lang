# Langium Parser and Language Server Foundation

Wire Lang's MVP will use Langium as the parser and validation foundation, with the same grammar and validation model intended to support a future language server. We chose this over a hand-written parser, Lezer, Tree-sitter, or Chevrotain because the first workflow needs structured diagnostics for coding agents now, while preserving a direct path to TypeScript-like editor feedback later. The MVP feedback surface remains CLI-driven; a headless language server and VS Code extension are post-MVP follow-ups.

## Implementation status

The first implementation slice ships a small hand-written tokenizer and recursive-descent parser in `@wire-lang/core` (`src/parser`). It produces the same public/partial AST contract (`src/ast/nodes.ts`) with source locations and error-node recovery, and the same structured parse diagnostics this ADR calls for. The public AST is deliberately decoupled from the parser implementation so the parser can be replaced without breaking consumers.

Adopting Langium remains the planned next step toward the headless language server and editor tooling: it would regenerate the public AST from a `.wire` grammar and reuse the existing validators, schematic model, layout engine, and SVG renderer unchanged. The hand-written parser was chosen for the first slice to land a complete, tested `parse → compile → layout → renderSvg → CLI` pipeline without the grammar/codegen tuning that Langium's lexer needs for this token mix (quantities like `220ohm`/`3V3`, terminal references like `BT1.+`, hyphenated enum values, and digit-leading net names).
