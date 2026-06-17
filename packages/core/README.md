# @wire-lang/core

Core library for [Wire Lang](https://github.com/eduardozf/wire-lang): a
text-first language for electronic schematics that renders to clean SVG. This
package is the full pipeline — parser, compiler, schematic model, deterministic
layout engine, and SVG renderer — with no CLI or filesystem dependencies.

```bash
npm install @wire-lang/core
```

## Usage

```ts
import { renderSvg, compile } from "@wire-lang/core";

const source = `schematic
  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red
  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-
`;

// One-shot: source -> standalone SVG string.
const svg = renderSvg(source);

// Or inspect diagnostics and the schematic model first.
const { ok, model, diagnostics } = compile(source);
```

`renderSvg` throws a `WireLangError` (carrying structured `diagnostics`) when the
source has fatal errors. Use `compile` when you want to read diagnostics without
throwing.

## API surface

- `parse(source)` — source to a public, renderer-independent AST (with partial
  ASTs and `ErrorNode`s on invalid input).
- `compile(source | DocumentNode)` — AST/source to a `SchematicModel` plus
  diagnostics.
- `layout(model)` — schematic model to a coordinate `LayoutModel`.
- `serializeSvg(layoutModel)` / `renderSvg(source | model)` — SVG output.
- `parseQuantity`, `getStandardComponent`, `DiagnosticCodes`, `WireLangError`,
  and the full set of model/AST/layout types.

Diagnostics carry stable `code` strings (see `DiagnosticCodes`); messages may
change between versions, codes are the contract.

## License

MIT
