# Wire Lang

Text-first electronic schematics for documentation, prototyping, and AI-assisted authoring.

Wire Lang is a planned JavaScript/TypeScript library and minimal developer CLI for describing electronic circuits in a small declarative language and rendering them as clean, readable SVG schematics.

```wire
schematic
  title "LED current limiting circuit"
  description "A 5V battery drives a red LED through a 220 ohm resistor."

  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red

  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-

  annotation "Current limiting resistor" near R1
  render direction=left-to-right
```

## Status

The MVP is implemented. The repository is a pnpm monorepo with a working
`parse → compile → layout → renderSvg` pipeline and a developer CLI (`wire
check`/`render`/`watch`). It still contains the product vocabulary, MVP
specification, architecture decisions, contribution policy, and license.

The current scope is intentionally narrow: parse `.wire` source, provide strong diagnostics and AST feedback, compile to a renderer-independent schematic model, compute stable layout, render standalone SVG, and expose a minimal CLI feedback loop for developers and AI coding agents.

### Packages

- [`wire-lang`](./packages/wire-lang) — user-facing aggregate package and the `wire` binary
- [`@wire-lang/core`](./packages/core) — parser, compiler, schematic model, layout engine, SVG renderer
- [`@wire-lang/cli`](./packages/cli) — `wire check`, `wire render`, `wire watch`

### Develop

```bash
pnpm install
pnpm build       # tsup builds + tsc project-reference typecheck
pnpm test        # vitest
node packages/wire-lang/dist/bin.js render examples/led.wire --out led.svg
```

## Why Wire Lang

Electronic schematics are often trapped in GUI tools, screenshots, or proprietary project files. That makes them hard to review, generate, version, embed in docs, or maintain alongside code.

Wire Lang aims to make schematics:

- **Textual**: easy to diff, review, generate, and store in source control.
- **Readable**: optimized for documentation-style SVG output.
- **Precise**: models electrical nets, terminals, and components instead of treating lines as loose drawings.
- **AI-friendly**: exposes parse diagnostics, partial ASTs, source locations, and suggested fixes for authoring workflows.
- **Stable**: deterministic auto-layout is a core requirement, not an afterthought.

The main product reference is Mermaid: text goes in, documentation-friendly diagrams come out. Wire Lang applies that model to electronic schematics rather than flowcharts, sequence diagrams, or general-purpose charts.

## MVP Scope

The first version targets schematic documentation, not physical design or simulation.

Included in the MVP:

- `.wire` source files
- declarative `schematic` documents
- components, terminals, named nets, anonymous connections, and power nets
- local component definitions with standard-symbol terminal mapping
- annotations, comments, title, and description
- render hints for direction, orientation, side, anchor, and net wire/label style
- stable auto-layout with no source-level absolute coordinates
- standalone SVG output with accessible title/description and stable metadata
- minimal CLI commands for checking, rendering, and watching `.wire` files
- `parse`, `compile`, and `renderSvg` JavaScript APIs

Outside the MVP:

- simulation
- PCB layout
- breadboard layout
- BOM generation
- polished end-user CLI workflows beyond check/render/watch
- preview server command
- browser auto-render
- Canvas rendering
- custom symbol drawing
- Markdown processing
- headless language server
- VS Code extension
- complex board modules such as Arduino or ESP32

See [docs/MVP.md](./docs/MVP.md) for the full MVP specification.

## Language Preview

Wire Lang separates the electrical model from the rendered drawing.

```wire
schematic
  component R1 Resistor value=10k
  component D1 LED color=red

  net VCC: R1.1
  connect R1.2, D1.A
  net GND: D1.C
```

In this source:

- `R1` and `D1` are component instances.
- `Resistor` and `LED` are component types.
- `VCC` and `GND` are nets.
- `connect R1.2, D1.A` creates an anonymous net.
- visual wires are renderer output, not the electrical source of truth.

Local components can be declared directly in a `.wire` file:

```wire
define component SoilSensor
  terminal VCC
  terminal GND
  terminal AOUT
  terminal DOUT
  symbol module
end

component S1 SoilSensor
```

The built-in component library can be overridden locally:

```wire
define component LED
  terminal positive_leg
  terminal negative_leg
  symbol led
    map anode = positive_leg
    map cathode = negative_leg
  end
end
```

## Planned API

The MVP API is designed around authoring feedback and a simple happy path:

```ts
import { compile, parse, renderSvg } from "wire-lang";

const parsed = parse(source);
const compiled = compile(source);
const svg = renderSvg(source);
```

Planned behavior:

- `parse(source)` returns a public AST for valid source, or a partial AST with diagnostics for invalid source.
- `compile(source | ast)` returns a renderer-independent schematic model and diagnostics.
- `renderSvg(source | model)` returns an SVG string on success and throws `WireLangError` with diagnostics if rendering cannot complete.

The MVP parser and validation foundation is planned to use Langium so grammar, diagnostics, and future language-server support can share the same model. The first MVP feedback loop is CLI-driven; the headless language server and VS Code extension are post-MVP follow-ups.

The MVP repository is planned as a pnpm monorepo with separate packages for core rendering and the developer CLI. Users install the `wire-lang` aggregate package, while scoped workspace packages keep implementation boundaries clear. Packages are ESM-only and target Node.js 20 or newer. TypeScript project references provide package-level type checking, tsup builds the packages, and Vitest is the primary test runner. Layout is a custom deterministic engine rather than a general graph-layout dependency, and SVG output is generated through a direct serializer. Browser auto-render, the language server, and editor integrations are post-MVP packages.

Post-MVP browser auto-render is planned to mirror the ergonomics of documentation diagram tools:

```html
<pre class="wire-lang">
schematic
  component R1 Resistor value=220ohm
  component D1 LED
  connect R1.2, D1.A
</pre>

<script type="module">
  import { run } from "wire-lang";
  await run();
</script>
```

The minimal CLI is planned for developer and AI-agent feedback:

```bash
wire check examples/led.wire
wire check examples/led.wire --json
wire render examples/led.wire --out examples/led.svg
wire render examples/led.wire --out examples/led.svg --json
wire watch examples/led.wire --out examples/led.svg
```

CLI diagnostics are human-readable by default and available as JSON with `--json` for AI agents, scripts, and automation.

CLI exit codes are `0` for success with or without warnings, `1` for fatal source or render diagnostics, and `2` for usage, file I/O, or configuration problems.

The MVP does not include a preview server; open the generated SVG file directly.

## Standard Component Library

The MVP standard library is deliberately small:

- `Resistor`
- `Capacitor`
- `PolarizedCapacitor`
- `Inductor`
- `Diode`
- `LED`
- `NPNTransistor`
- `PNPTransistor`
- `Battery`
- `GroundReference`
- `SPSTSwitch`
- `PushButton`
- `Header`

Complex modules, broader semiconductor support, sensors, displays, motors, relays, and project-specific libraries are planned for later work.

## Standards and Conventions

Wire Lang uses familiar electronic schematic conventions and IEC-style symbols where practical. It does not claim full compliance with IEC 60617, IEEE 315, or any other formal standard.

References to standards are used to explain design background and terminology. Wire Lang's built-in symbols must be original open-source drawings intended for documentation, education, and prototyping.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the symbol artwork policy.

## Project Documents

- [MVP specification](./docs/MVP.md)
- [Domain vocabulary](./CONTEXT.md)
- [Architecture decisions](./docs/adr/)
- [Contributing guide](./CONTRIBUTING.md)
- [MIT license](./LICENSE)

## Contributing

Wire Lang is early and design-heavy right now. The most useful contributions are:

- tightening the MVP language specification
- challenging ambiguous syntax or validation rules
- proposing test cases for parsing, diagnostics, and layout stability
- designing original schematic symbols within the contribution policy
- planning the first implementation slices

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before contributing symbol artwork or standard-library definitions.

## License

Wire Lang is released under the [MIT License](./LICENSE).
