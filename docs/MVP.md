# Wire Lang MVP

This document defines the first useful version of Wire Lang: a JavaScript/TypeScript library and minimal developer CLI for turning textual electronic schematic descriptions into readable SVG diagrams.

Wire Lang is not a breadboard tool, PCB layout tool, simulator, BOM manager, or visual editor in the MVP. It is a documentation-oriented schematic renderer with strong authoring feedback for humans, editors, and AI agents.

The main product reference is Mermaid: a text-first documentation workflow where source blocks render into diagrams. Wire Lang follows that product shape for electronic schematics, but it is not a Mermaid plugin and does not aim for Mermaid syntax compatibility.

## Goals

- Let users describe electronic schematics with a declarative `.wire` source format.
- Render documentation-friendly, standalone SVG output.
- Keep the electrical model precise by using components, terminals, and nets.
- Provide structured diagnostics and AST feedback for editor and AI-assisted authoring.
- Support an agent/developer feedback loop for checking `.wire` source and rendering SVG from the command line.
- Use deterministic, stable auto-layout so small source edits do not unnecessarily redraw the whole schematic.
- Ship a small built-in component library for common educational and prototyping circuits.

## Non-Goals

- No electrical simulation.
- No PCB layout, footprints, routing, or manufacturing output.
- No breadboard layout.
- No BOM generation.
- No custom symbol drawing language.
- No Canvas renderer.
- No polished end-user CLI beyond minimal check, render, and watch commands.
- No preview server command in the MVP.
- No browser auto-render in the MVP.
- No headless language server, Markdown processor, or VS Code extension in the MVP.
- No formal IEC 60617, IEEE 315, or other standards compliance claim.

## Source Format

Wire files use the `.wire` extension, are UTF-8, and contain exactly one source document in the MVP.

Every MVP document starts with the `schematic` document kind:

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

The core language is declarative. The source declares components, nets, annotations, groups, and render hints; it does not contain absolute coordinates.

## Core Concepts

**Component Instance**
: A uniquely identified occurrence of a component type in a schematic, declared with `component`.

**Terminal**
: A named connection point exposed by a component type.

**Net**
: A logical electrical connection joining one or more terminals.

**Visual Wire**
: The rendered line used to show part of a net. Wires are visual output; nets are the electrical model.

**Schematic Symbol**
: The visual representation of a component.

**Module Symbol**
: A generic block symbol with exposed terminals, used for headers and local module-style components.

## Statements

### Components

```wire
component R1 Resistor value=220ohm
component D1 LED color=red
component J1 Header pins=[VCC,GND,SDA,SCL]
```

Component statements require the `component` keyword. Each component instance has a unique instance ID.

Conventional designator prefixes, such as `R` for resistors and `D` for LEDs, should produce warnings when mismatched rather than errors.

### Local Component Definitions

Local definitions override standard component definitions within the same source document.

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

Blocks use `define ... end`; indentation is for readability only.

If a local component uses a built-in symbol with semantic roles, it must map its terminals to the symbol roles:

```wire
define component MyLed
  terminal positive_leg
  terminal negative_leg
  symbol led
    map anode = positive_leg
    map cathode = negative_leg
  end
end
```

Custom symbol definitions are outside the MVP. Local components without specialized symbols use `symbol module`.

### Nets

Named nets:

```wire
net VCC: BT1.+, R1.1
net GND: D1.C, BT1.-
```

Anonymous nets:

```wire
connect R1.2, D1.A
```

Repeated named net declarations merge into one logical net:

```wire
net VCC: BT1.+
net VCC: R1.1, C1.1
```

A terminal assigned to multiple different nets is a fatal validation issue.

Floating nets, with only one terminal, are allowed and produce warnings.

### Power Nets

Names such as `VCC`, `5V`, `3V3`, and `GND` are conventional power nets. They are not magic globals and do not create hidden connections.

`GND` does not automatically create a `GroundReference` component:

```wire
component G1 GroundReference
net GND: G1.GND, BT1.-
```

Nets render as visual wires by default. Label rendering requires an explicit render hint:

```wire
render net VCC style=label
```

### Groups

Groups are intended to guide layout. A component instance can belong to at most
one group in the MVP.

> **Status:** Group statements are parsed, validated, and recorded on the
> schematic model, but the bundled layout engine does not yet position by group
> membership or `side`. Using a `group` statement emits a `group.not-yet-honored`
> warning. Honoring groups in layout is post-MVP (see Roadmap).

```wire
group Inputs: S1, R_PULLUP
group Outputs: D1, R_LED

render Inputs side=left
render Outputs side=right
```

Instance IDs and group names share a target namespace, so `render TARGET ...` is never ambiguous. Net names live in their own namespace and are targeted with `render net NAME ...`.

### Render Hints

MVP render hints:

```wire
render direction=left-to-right
render R1 orientation=vertical
render Inputs side=left
render U1 anchor=center
render net GND style=wire
render net VCC style=label
```

Supported values:

- `direction`: `left-to-right`, `right-to-left`, `top-to-bottom`, `bottom-to-top` — honored.
- net `style`: `wire`, `label` — honored.
- `orientation`: `horizontal`, `vertical` — accepted, not yet honored.
- `side`: `left`, `right`, `top`, `bottom` — accepted, not yet honored.
- `anchor`: `center` — accepted, not yet honored.

Default direction is `left-to-right`.

> **Status:** `direction` and net `style` are honored by the bundled layout
> engine. `orientation`, `side`, and `anchor` are validated and recorded on the
> model, but the engine does not yet position by them; using one emits a
> `render.not-yet-honored` warning so authors are not misled. Honoring these is
> post-MVP (see Roadmap).

Duplicate or unresolvable render hints produce warning diagnostics. Duplicate global hints use the last value.

### Annotations

Comments are source-only and do not appear in the public AST. Visible text uses annotations:

```wire
// Source-only comment
annotation "Status LED" near D1
annotation "Power rail" near net VCC
```

MVP annotations target either a component instance or a named net.

## Standard Component Library

The MVP ships a small standard component library.

| Component | Terminals | Properties | Default Labels | Symbol |
| --- | --- | --- | --- | --- |
| `Resistor` | `1`, `2` | recommended `value: resistance` | `id`, `value` | `resistor` |
| `Capacitor` | `1`, `2` | recommended `capacitance: capacitance` | `id`, `capacitance` | `capacitor` |
| `PolarizedCapacitor` | `+`, `-` | recommended `capacitance: capacitance` | `id`, `capacitance` | `polarized-capacitor` |
| `Inductor` | `1`, `2` | recommended `inductance: inductance` | `id`, `inductance` | `inductor` |
| `Diode` | `A`, `C` | none | `id` | `diode` |
| `LED` | `A`, `C` | optional `color: enum(red, green, blue, yellow, white, amber)` | `id` | `led` |
| `NPNTransistor` | `C`, `B`, `E` | none | `id` | `npn-transistor` |
| `PNPTransistor` | `C`, `B`, `E` | none | `id` | `pnp-transistor` |
| `Battery` | `+`, `-` | recommended `voltage: voltage` | `id`, `voltage` | `battery` |
| `GroundReference` | `GND` | none | none | `ground-reference` |
| `SPSTSwitch` | `1`, `2` | optional `state: enum(open, closed)` | `id` | `spst-switch` |
| `PushButton` | `1`, `2` | optional `normally: enum(open, closed)` | `id` | `push-button` |
| `Header` | from `pins=[...]` | recommended `pins: pin-list` | `id` | `module` |

MOSFETs and complex board modules such as Arduino boards are outside the MVP.

## Properties and Quantities

Component definitions declare property types. Supported MVP property value kinds:

- quantity
- string
- boolean
- enum

Unit-bearing properties normalize to quantities in the schematic model while preserving useful display labels.

Examples accepted by the parser:

```wire
value=220ohm
value=220Ω
value=10k
voltage=5V
capacitance=100nF
```

Missing recommended properties produce warning diagnostics, not errors. Unknown properties produce warning diagnostics and are preserved in the schematic model for future tools or plugins.

## Parsing, Compilation, and Rendering

The MVP public APIs are:

```ts
parse(source): ParseResult
compile(source | ast): CompileResult
renderSvg(source | model): string
```

`parse(source)` returns a public AST for valid source, or a partial AST with diagnostics for invalid source.

The partial AST is structural. It uses error nodes for invalid fragments and is not a lossless token-level tree. Relevant AST nodes carry source locations with line, column, and offset ranges.

`compile(source | ast)` returns a normalized schematic model and diagnostics.

`renderSvg(source | model)` is the happy-path API. It returns an SVG string on success and throws `WireLangError` with structured diagnostics when rendering cannot complete.

The MVP ships a small hand-written tokenizer and parser in `@wire-lang/core`.
The public AST, source ranges, error-node recovery, and structured diagnostics
are deliberately decoupled from that implementation so the parser can later
move to Langium without changing the public API. Langium remains the planned
foundation for the headless language server and editor tooling.

The MVP does not ship a language server. The first usable authoring loop is command-line driven; a headless language server and editor extensions are post-MVP follow-ups.

## Package Structure

Wire Lang uses a monorepo for the MVP so the core library, CLI, and future browser/editor-facing packages can evolve behind clear package boundaries.

Initial MVP packages:

- `wire-lang`: user-facing aggregate package that re-exports the common API and provides the `wire` binary
- `@wire-lang/core`: parser, validators, compiler, schematic model, layout model, and SVG renderer
- `@wire-lang/cli`: `wire check`, `wire render`, and `wire watch`

Post-MVP packages:

- `@wire-lang/browser`
- `@wire-lang/language-server`
- editor integrations such as a VS Code extension

The monorepo uses pnpm workspaces, TypeScript project references for package-level type checking, and tsup for package builds.

MVP packages are ESM-only and target Node.js 20 or newer. The MVP does not ship CommonJS builds.

Vitest is the primary MVP test runner. Tests should cover parser diagnostics, schematic model normalization, layout stability, SVG output, and CLI behavior. Browser automation can be added later for DOM auto-render integration.

The MVP uses a custom deterministic layout engine rather than a general graph layout dependency. The first layout implementation should be modest and schematic-specific: source-order and render-hint driven placement, deterministic component groups, stable module pin layout, orthogonal visual wires, and snapshot-tested layout/SVG output.

The SVG renderer generates markup directly from the layout model through a small deterministic SVG/XML serializer. It does not use D3, a browser DOM dependency, JSX, or a virtual DOM layer in the MVP.

## Agent and Developer CLI

The MVP includes a minimal command-line interface for developer and AI-agent feedback loops. It is a thin wrapper around the core parser, compiler, layout, and SVG renderer.

Required MVP commands:

```bash
wire check path/to/circuit.wire
wire check path/to/circuit.wire --json
wire render path/to/circuit.wire --out path/to/circuit.svg
wire render path/to/circuit.wire --out path/to/circuit.svg --json
wire watch path/to/circuit.wire --out path/to/circuit.svg
```

`wire check` reports parse, reference, validation, and render-blocking diagnostics without producing SVG output.

`wire render` writes standalone SVG output when rendering can complete and reports structured diagnostics when it cannot.

`wire watch` reruns checking and rendering when the input file changes.

The MVP does not include `wire preview` or a local preview server. Previewing is done by opening the generated SVG file directly.

The CLI emits human-readable diagnostics by default and supports `--json` for machine-readable diagnostic output. JSON output must include stable diagnostic codes, severity, message, source range, and suggested fixes when available.

CLI exit codes:

- `0`: command completed and no fatal diagnostics prevented the requested operation; warnings may be present
- `1`: source has fatal diagnostics or rendering cannot complete
- `2`: CLI usage, file I/O, or configuration problem

## Diagnostics

Diagnostics include:

- severity: `error` or `warning`
- stable diagnostic code
- human-readable message
- source location
- optional suggested fixes for high-confidence mechanical corrections

Fatal validation issues produce errors. Recoverable validation issues produce warnings.

Fatal examples:

- unknown document kind
- syntax that prevents structural parsing
- unknown component type
- unknown terminal on a resolved component type
- one terminal assigned to multiple different nets
- malformed local component definition that cannot be resolved

Warning examples:

- component instance with no connections
- floating net
- missing recommended property
- unknown property
- unusual designator prefix
- duplicate or unresolved render hint
- multiple disconnected subschematics

Suggested fixes must not invent circuit intent. They are appropriate for mechanical changes such as canonical capitalization or alias replacement.

## Schematic Model

The schematic model is renderer-independent and contains:

- document metadata: title, description, language version
- resolved component types used by the document
- component instances
- local component definitions
- normalized nets
- annotations
- render hints
- diagnostics

The model includes only component types used by the document, not the full standard component library.

Declaration order does not carry electrical meaning. Reference resolution happens after parsing.

## Layout Model

The layout model is renderer-independent and uses abstract layout units, not SVG pixels.

Auto-layout is the default. Absolute coordinates are outside the MVP.

Stable auto-layout is a core requirement:

- same source + same library version + same renderer version should produce the same SVG
- source order and instance IDs are deterministic tie-breakers
- small source edits should avoid unnecessary global diagram churn where practical

Layout priority:

1. render hints
2. stability
3. source order
4. crossing reduction
5. compactness

Multiple disconnected subschematics are allowed and render separately in stable source order.

## SVG Renderer

The MVP renderer emits standalone SVG by default. External styling can be supported as an integration option.

SVG output should include:

- accessible `<title>` and `<desc>` from source title/description or generated fallback text
- real SVG `<text>` labels, not outlined text paths
- stable `data-wire-*` metadata
- stable classes
- sanitized IDs where IDs are emitted
- junction dots for explicit visual wire connections

Crossing wires without a junction dot are not connected.

Standard symbols use an IEC-style visual profile where practical. Wire Lang does not claim full IEC 60617, IEEE 315, or other formal standards compliance.

## Post-MVP Browser Auto Render

Browser auto-render is outside the MVP. The planned post-MVP browser integration finds source blocks by default:

```css
pre.wire-lang, code.wire-lang
```

`run()` should preserve the original source block and insert a separate rendered container. It should be idempotent by default:

```ts
await run()
await run() // does not duplicate output
await run({ force: true }) // may re-render explicitly
```

## Post-MVP Roadmap

High-priority follow-ups:

- honor the placement hints the compiler already records: per-component
  `orientation`/`anchor`, and `side` for components and groups, plus
  group-aware layout (today these emit `render.not-yet-honored` /
  `group.not-yet-honored` warnings)
- browser auto-render for `pre.wire-lang` and `code.wire-lang`
- headless language server using a Langium grammar and the existing validators
- VS Code extension with syntax highlighting, diagnostics, and authoring feedback
- Markdown/MDX integrations using the `wire` fenced code tag
- custom component libraries passed through the JavaScript API

Later extensions:

- Canvas renderer
- custom symbol definition language
- simulation plugin
- BOM plugin
- complex board modules such as Arduino and ESP32
- MOSFETs, op-amps, relays, motors, displays, sensors, and richer component libraries
- interactive links in SVG output

## Reference Documents

- [CONTEXT.md](./CONTEXT.md) defines the project language and domain vocabulary.
- [ADR 0001](./adr/0001-javascript-library-with-svg-renderer.md) records the JavaScript library and SVG renderer decision.
- [ADR 0002](./adr/0002-stable-auto-layout.md) records the stable auto-layout decision.
- [ADR 0003](./adr/0003-iec-style-symbols-without-compliance-claim.md) records the IEC-style-without-compliance-claim decision.
- [ADR 0004](./adr/0004-public-and-partial-ast-for-authoring-feedback.md) records the public and partial AST decision.
- [ADR 0005](./adr/0005-minimal-developer-cli-for-agent-feedback.md) records the minimal developer CLI decision.
- [ADR 0006](./adr/0006-langium-parser-and-language-server-foundation.md) records the hand-written MVP parser and Langium migration-path decision.
- [ADR 0007](./adr/0007-monorepo-package-structure.md) records the monorepo package-structure decision.
- [ADR 0008](./adr/0008-public-wire-lang-package.md) records the public aggregate package decision.
- [ADR 0009](./adr/0009-pnpm-typescript-project-references-and-tsup.md) records the package manager and build toolchain decision.
- [ADR 0010](./adr/0010-vitest-primary-test-runner.md) records the MVP test runner decision.
- [ADR 0011](./adr/0011-custom-deterministic-layout-engine.md) records the custom deterministic layout engine decision.
- [ADR 0012](./adr/0012-direct-svg-serializer.md) records the direct SVG renderer decision.
- [ADR 0013](./adr/0013-cli-human-and-json-diagnostics.md) records the CLI diagnostic output decision.
- [ADR 0014](./adr/0014-cli-exit-codes.md) records the CLI exit-code decision.
- [ADR 0015](./adr/0015-no-preview-server-in-mvp.md) records the MVP preview decision.
- [ADR 0016](./adr/0016-browser-auto-render-post-mvp.md) records the browser auto-render scope decision.
- [ADR 0017](./adr/0017-esm-only-node-20.md) records the runtime and module-format decision.
