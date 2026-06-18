# Hand-Written MVP Parser with Langium Migration Path

Wire Lang's MVP ships a small hand-written tokenizer and recursive-descent
parser in `@wire-lang/core`, while keeping Langium as the planned migration
path for a future language server. We chose this over requiring Langium in the
first release because the MVP needed a complete, tested
`parse -> compile -> layout -> renderSvg -> CLI` pipeline before investing in
grammar/codegen tuning for Wire Lang's token mix. The public AST and diagnostic
contracts remain parser-independent so a later Langium implementation can
replace the parser without breaking consumers.

## Implementation status

The first implementation slice ships a small hand-written tokenizer and recursive-descent parser in `@wire-lang/core` (`src/parser`). It produces the same public/partial AST contract (`src/ast/nodes.ts`) with source locations and error-node recovery, and the same structured parse diagnostics this ADR calls for. The public AST is deliberately decoupled from the parser implementation so the parser can be replaced without breaking consumers.

Adopting Langium remains the planned next step toward the headless language server and editor tooling: it would regenerate the public AST from a `.wire` grammar and reuse the existing validators, schematic model, layout engine, and SVG renderer unchanged. The hand-written parser was chosen for the first slice to land a complete, tested `parse → compile → layout → renderSvg → CLI` pipeline without the grammar/codegen tuning that Langium's lexer needs for this token mix (quantities like `220ohm`/`3V3`, terminal references like `BT1.+`, hyphenated enum values, and digit-leading net names).
