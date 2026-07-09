# Wire Lang

Wire Lang is a textual language for describing electronic circuit schematics and rendering them as readable diagrams.

## Language

**Wire Lang**:
The project and language name for textual electronic schematic documents.
_Avoid_: Wire, WireScript, Circuit Lang

**Mermaid**:
The main product reference for Wire Lang's text-first documentation workflow.
_Avoid_: dependency, syntax compatibility target

**Schematic**:
A logical circuit diagram that shows components, terminals, and electrical connections without representing physical layout, breadboard placement, PCB routing, or simulation behavior.
_Avoid_: breadboard diagram, PCB layout, electrical simulation

**Disconnected Subschematic**:
A connected subset of a **Schematic** that has no nets in common with another subset.
_Avoid_: separate source document, invalid circuit

**Component**:
An electrical part or module represented in a **Schematic**.
_Avoid_: symbol, drawing, footprint

**Component Instance**:
A uniquely identified occurrence of a component type inside a **Schematic**.
_Avoid_: component type, component definition

**Component Statement**:
A source statement that declares a **Component Instance**.
_Avoid_: local component definition, shorthand instance syntax

**Instance ID**:
The unique designator that identifies a **Component Instance** in a **Source Document**.
_Avoid_: component type, display name

**Target Name**:
A source-level name that can be used as the target of a render hint.
_Avoid_: component type, terminal name

**Name Namespace**:
A set of source names that must be unique relative to each other.
_Avoid_: global uniqueness for all names

**Terminal**:
A named connection point exposed by a component type.
_Avoid_: visual wire, net, pin number when the component does not use pin numbers

**Module**:
A complex **Component** whose internal circuit is hidden behind a high-level set of exposed terminals.
_Avoid_: expanded circuit, PCB layout, black box

**Schematic Symbol**:
The standardized visual representation of a **Component** in a **Schematic**.
_Avoid_: component, footprint, freeform illustration

**Symbol Style Profile**:
The visual convention followed by the standard schematic symbols.
_Avoid_: formal standards compliance claim, copied standard catalog

**Symbol Terminal Role**:
A named connection role expected by a **Schematic Symbol**, such as `anode`, `cathode`, `collector`, `base`, `emitter`, `positive`, or `negative`.
_Avoid_: terminal name, instance ID

**Symbol Terminal Mapping**:
The mapping from a component type's **Terminals** to the **Symbol Terminal Roles** expected by its **Schematic Symbol**.
_Avoid_: net connection, render hint

**Module Symbol**:
A **Schematic Symbol** that represents a **Module** as a simplified block with exposed terminals.
_Avoid_: internal schematic, footprint

**Module Pin Layout**:
The deterministic placement of module terminals around a **Module Symbol**.
_Avoid_: physical pin placement, PCB footprint

**Custom Symbol Definition**:
A user-authored drawing definition for a new **Schematic Symbol**.
_Avoid_: local component definition, module symbol fallback

**Component Library**:
A structured catalog of known component types, canonical terminal names, aliases, properties, and schematic symbols.
_Avoid_: freeform component list, renderer-only asset library

**Standard Component Library**:
The built-in **Component Library** shipped with Wire Lang.
_Avoid_: local definitions, user project library

**Custom Component Library**:
An application-provided component catalog passed through the JavaScript API.
_Avoid_: standard library, local component definition

**Local Component Definition**:
A component type definition declared inside a **Source Document** that can add or override known component behavior for that document.
_Avoid_: component instance, standard library component

**Definition Block**:
A source block that declares a local definition and is closed with `end`.
_Avoid_: indentation-based block, component instance

**Canonical Name**:
The normalized name used internally for a component type, terminal, property, or symbol after aliases are resolved.
_Avoid_: alias, display label, user spelling

**Electrical Property**:
A property that changes the electrical meaning or identity of a **Component Instance**.
_Avoid_: render hint, layout preference

**Property Type**:
The expected value kind for an **Electrical Property**, such as quantity, string, boolean, or enum.
_Avoid_: raw string, display label

**Recommended Property**:
An **Electrical Property** that a component type expects for a complete diagram but does not require for rendering.
_Avoid_: required property, render hint

**Unknown Property**:
A property declared on a component instance that is not defined by that component type.
_Avoid_: invalid syntax, known electrical property

**Quantity**:
A normalized numeric value with an electrical unit, such as resistance, voltage, or capacitance.
_Avoid_: raw property string, display label

**Display Label**:
The human-facing text used when rendering a property, component, net, or annotation.
_Avoid_: normalized quantity, canonical name

**Default Property Label**:
A component-type rule that chooses which electrical properties render as labels by default.
_Avoid_: render hint, annotation

**SVG Text Label**:
A rendered SVG `<text>` element used for labels and annotations.
_Avoid_: outlined text path, rasterized text

**Render Hint**:
A non-electrical instruction that guides how a **Schematic** should be drawn.
_Avoid_: electrical property, simulation parameter

**Global Render Hint**:
A **Render Hint** that applies to the whole **Schematic**.
_Avoid_: component property, net declaration

**Targeted Render Hint**:
A **Render Hint** that applies to a specific component instance, component group, or net.
_Avoid_: electrical property, global setting

**Component Group**:
A named set of component instances used to communicate diagram organization and guide layout.
_Avoid_: electrical net, nested layout container

**Group Statement**:
A source statement that declares a **Component Group** by listing component instance IDs.
_Avoid_: render hint, net declaration

**Auto Layout**:
The default rendering behavior that computes component placement and visual wire routing from the declared circuit structure.
_Avoid_: manual coordinates, PCB routing

**Stable Auto Layout**:
An **Auto Layout** requirement that the same source, library version, and renderer version produce deterministic output and avoid unnecessary global layout changes.
_Avoid_: best-effort random layout, force-directed instability

**Layout Priority**:
The ordered trade-off rules used when **Auto Layout** cannot optimize every visual goal at once.
_Avoid_: absolute layout guarantee, renderer accident

**Simulation Plugin**:
A future extension that interprets a **Schematic** for electrical simulation or measurement behavior.
_Avoid_: MVP renderer, standard schematic rendering

**BOM Plugin**:
A future extension that derives a bill of materials from structured component instances and properties.
_Avoid_: MVP schematic renderer, electrical simulation

**Schematic Model**:
The normalized, renderer-independent representation of a parsed **Source Document**.
_Avoid_: AST, SVG, canvas scene

**Public AST**:
A source-level syntax tree exposed as part of Wire Lang's public API for editor tooling, codemods, or advanced integrations.
_Avoid_: normalized schematic model, SVG output

**Partial AST**:
A best-effort **Public AST** produced from syntactically invalid source.
_Avoid_: strict parse result, normalized schematic model

**Error Node**:
A placeholder node in a **Partial AST** representing source text that could not be parsed into a valid structure.
_Avoid_: diagnostic, token stream entry

**Source Location**:
The line, column, and offset range attached to diagnostics and public AST nodes.
_Avoid_: rendered position, layout coordinate

**Authoring Feedback**:
Structured information returned to help humans, editors, and AI agents understand and fix source problems while writing Wire Lang.
_Avoid_: render-only failure, console-only warning

**Layout Model**:
The renderer-independent placement and routing result computed from a **Schematic Model**.
_Avoid_: SVG, canvas commands, source document

**Layout Unit**:
An abstract coordinate unit used inside a **Layout Model** before renderer-specific scaling.
_Avoid_: SVG pixel, source coordinate

**SVG Renderer**:
The initial renderer that turns a **Layout Model** into an SVG schematic diagram.
_Avoid_: canvas renderer, simulation engine

**Standalone SVG**:
An SVG output that includes the minimum styles needed to render correctly without external CSS.
_Avoid_: app-only SVG, unstyled markup

**SVG Metadata**:
Stable attributes and classes emitted into SVG output to identify rendered Wire Lang elements.
_Avoid_: visual-only SVG, unstable generated IDs

**Interactive Link**:
A clickable link associated with a rendered component, net, or annotation.
_Avoid_: SVG metadata, display label

**Theme Styling**:
Visual customization applied to rendered output through SVG classes and CSS custom properties.
_Avoid_: source-level electrical declarations, per-element drawing commands

**JavaScript Library**:
The initial product form of Wire Lang, exposing APIs to parse source documents and render schematics in JavaScript or TypeScript environments.
_Avoid_: CLI-first tool, desktop application

**Agent Authoring Workflow**:
A feedback loop where a human or AI coding agent writes a **Wire File**, checks diagnostics, renders SVG output, inspects the result, and revises the source.
_Avoid_: polished web editor, simulation workflow

**Developer CLI**:
The minimal command-line surface that lets developers and AI coding agents check **Wire Files** and render SVG during the MVP.
_Avoid_: CLI-first product, polished end-user application

**Check Command**:
A **Developer CLI** command that reports parse, reference, validation, and render-blocking diagnostics for a **Wire File** without producing SVG output.
_Avoid_: render command, syntax-only parser smoke test

**Render Command**:
A **Developer CLI** command that turns a **Wire File** into an SVG file when no fatal diagnostics prevent rendering.
_Avoid_: DOM auto render, browser preview

**Watch Command**:
A **Developer CLI** command that reruns checking and rendering when a **Wire File** changes.
_Avoid_: language server, web editor

**Human Diagnostic Output**:
The default **Developer CLI** diagnostic format optimized for people reading terminal output.
_Avoid_: machine-readable contract, JSON API

**Machine Diagnostic Output**:
A JSON **Developer CLI** diagnostic format optimized for AI coding agents, scripts, and automation.
_Avoid_: human terminal formatting, unstable message parsing

**Compile API**:
The public API that turns a **Source Document** into a **Schematic Model** and **Diagnostics**.
_Avoid_: public AST API, SVG rendering

**Parse API**:
The public API that turns a **Source Document** into a **Public AST**, **Partial AST**, and **Diagnostics** for authoring tools.
_Avoid_: render API, normalized schematic model

**Render API**:
The public happy-path API that turns a **Source Document** or **Schematic Model** into an SVG string.
_Avoid_: CLI command, simulation API

**DOM Auto Render**:
A post-MVP browser integration that finds Wire Lang source blocks in the DOM and replaces or augments them with rendered schematics.
_Avoid_: MVP command-line rendering, manual API usage

**DOM Source Block**:
An HTML `pre` or `code` element containing a **Source Document** for **DOM Auto Render**.
_Avoid_: generated SVG container, CLI input file

**DOM Render Container**:
An HTML element inserted by **DOM Auto Render** to hold the rendered SVG while preserving the original **DOM Source Block**.
_Avoid_: source block replacement, generated SVG internals

**Diagnostic**:
A structured parser, validation, or normalization message with severity, code, human-readable text, and source location.
_Avoid_: thrown exception, console-only warning

**Diagnostic Code**:
A stable machine-readable identifier for a **Diagnostic**.
_Avoid_: human message, stack trace

**Recoverable Validation Issue**:
A suspicious or incomplete source condition that can still produce a useful schematic.
_Avoid_: fatal error, syntax error

**Fatal Validation Issue**:
A source condition that prevents Wire Lang from constructing a coherent schematic model or rendering safely.
_Avoid_: warning, recoverable issue

**Suggested Fix**:
An optional source edit attached to a **Diagnostic** when the correction is mechanical and high-confidence.
_Avoid_: inferred circuit design, speculative rewrite

**WireLangError**:
A public exception type that carries **Diagnostics** when a happy-path API cannot complete.
_Avoid_: plain string error, console-only failure

**Reference Resolution**:
The normalization step that links source references to their declared definitions after parsing.
_Avoid_: parse-time ordering requirement

**Floating Net**:
A **Net** that connects only one terminal.
_Avoid_: invalid syntax, disconnected component

**Net**:
A logical electrical connection that groups one or more component terminals that share the same electrical node.
_Avoid_: wire, physical cable, drawn line

**Named Net**:
A **Net** with an explicit source-level name.
_Avoid_: anonymous connection

**Net Merge**:
The normalization behavior that combines repeated **Named Net** declarations with the same name into one logical **Net**.
_Avoid_: duplicate net error, visual wire merge

**Net Conflict**:
A validation error where the same component terminal is assigned to multiple different **Nets**.
_Avoid_: net merge, render conflict

**Anonymous Net**:
A **Net** created from an unnamed source-level connection.
_Avoid_: named electrical node

**Connect Statement**:
A source statement that declares an **Anonymous Net** by listing connected terminals.
_Avoid_: visual edge, named net

**Power Net**:
A conventionally named **Net** used for power or reference potentials, such as `VCC`, `5V`, `3V3`, or `GND`.
_Avoid_: magic global, implicit connection, hidden wire

**Visual Wire**:
The rendered line used in a **Schematic** to show part of a **Net**.
_Avoid_: net, physical cable

**Junction Dot**:
A filled dot rendered where visual wires explicitly connect at a junction.
_Avoid_: wire crossing, decorative point

**Wire Hop**:
A semicircular glyph drawn where two **Visual Wires** cross without a **Junction Dot**, making the "not connected" relationship explicit. Opt-in via `render crossings=hop`; the default (`crossings=gap`) leaves such crossings simply overlapping.
_Avoid_: junction dot, electrical connection

**No-Connect Flag**:
A mark on a component terminal declaring it intentionally unconnected, drawn as an `X`. Declared with a `no-connect` statement.
_Avoid_: floating net, junction dot

**No-Connect Statement**:
A source statement, `no-connect TERMINAL`, that marks one or more terminals as intentionally unconnected.
_Avoid_: connect statement, net declaration

**Power Flag**:
A single-terminal **Component** (`PowerFlag`) whose `name` labels a power rail, such as `VBAT`, `5V`, or `3V3`. It is a visual flag and does not create a hidden global **Net**.
_Avoid_: power net, magic global, ground reference

**Power Rail** (bus-rail layout):
A horizontal trunk that distributes one power **Net** across the drawing — a supply rail along the top, a ground rail along the bottom — to which every member taps straight up or down with a **Junction Dot**. Detected by net name in the `bus-rail` layout. A rail never runs through the middle of the diagram or crosses a signal.
_Avoid_: bus trunk, signal wire

**Bus Trunk** (bus-rail layout):
A single thick line that visually bundles three or more signal **Nets** running between the same two blocks. Each net leaves its pin horizontally and converges to one shared entry point per side of the trunk, forming a tidy funnel; the trunk is decorative bundling, not an electrical **Net** of its own.
_Avoid_: power rail, single net, junction

**Net Family** (bus-rail layout):
A color class a **Net** is grouped into for legibility — supply (red), ground (dark), control (blue), and bundled signal groups (a cycling palette). Inferred from net names and member components, applied consistently across the drawing.
_Avoid_: net style, group

**Peripheral Band** (bus-rail layout):
The zone below the row (past every signal channel) where peripherals hang, each anchored under or beside the pin that feeds it instead of extending the row. Items sort by anchor-pin x; a colliding item shifts right and its feed jogs. Replaces the earlier control band; buttons and switches are ordinary peripherals.
_Avoid_: control band, second row

**Peripheral Chain** (bus-rail layout):
A series of two-terminal parts fed from one anchor pin and ending at ground or open — a GPIO → resistor → LED chain, a button to ground. Stands vertically under its anchor pin in chain order, each part auto-mirrored so its polarity faces the feed.
_Avoid_: group, subcircuit

**Bridge Peripheral** (bus-rail layout):
A single two-terminal part fed from two pins of the same anchor — a speaker across an amp's OUTP/OUTN. Hangs under the first pin (bottom-edge feeds) or beside the anchor (left/right-edge feeds), mirrored so the matching terminal faces each feed.
_Avoid_: chain, two-anchor series

**Mirror (auto-flip)**:
A geometry-level flip of a two-terminal part's terminals so its declared polarity faces the wire that feeds it (LED anode toward the resistor, speaker `+` toward the driving pin). Glyphs draw between terminal points, so a mirrored part renders correctly with no renderer special-casing; module and IC blocks never mirror.
_Avoid_: rotation, orientation hint

**Pin Number**:
The optional numeric (or alphanumeric) designator of an `IC` pin, declared in `pins=[number:name@side]` and rendered alongside the pin name.
_Avoid_: terminal name, instance ID

**Source Document**:
The text authored by a user to declare the components and nets of a **Schematic**.
_Avoid_: drawing, canvas, generated diagram

**Wire File**:
A `.wire` file containing a **Source Document**.
_Avoid_: generated SVG, component library file

**UTF-8 Source**:
A **Source Document** encoded as UTF-8, allowing Unicode characters in values, labels, and annotations.
_Avoid_: ASCII-only source

**Markdown Fence**:
A fenced code block tagged as `wire` for documentation systems that integrate Wire Lang.
_Avoid_: DOM source block, wire file

**Markdown Integration**:
The build-time `@wire-lang/markdown` plugins that replace a **Markdown Fence**
with standalone inline SVG through remark, rehype, or MDX.
_Avoid_: browser auto-render, raw HTML passthrough, Mermaid plugin

**VS Code Extension**:
A future editor integration for Wire Lang syntax highlighting, diagnostics, and authoring feedback.
_Avoid_: MVP core library, SVG renderer

**Headless Language Server**:
A post-MVP editor-service integration that provides Wire Lang diagnostics and authoring feedback through the Language Server Protocol without being tied to one editor.
_Avoid_: MVP CLI, VS Code extension

**Line Comment**:
A `//` comment in a **Source Document** that documents the source without changing the schematic.
_Avoid_: block comment, render label

**Annotation**:
Text intentionally rendered in a **Schematic** to explain or label part of the diagram.
_Avoid_: line comment, electrical property

**Annotation Target**:
A component instance or named net that an **Annotation** is placed near.
_Avoid_: absolute coordinate, line comment

**Schematic Title**:
The human-readable title of a **Schematic** used for documentation and accessible SVG output.
_Avoid_: instance label, annotation

**Schematic Description**:
A human-readable summary of a **Schematic** used for documentation and accessible SVG output.
_Avoid_: line comment, annotation

**Document Kind**:
The leading keyword in a **Source Document** that declares what kind of diagram the document describes.
_Avoid_: file extension, renderer option

**Language Version**:
The version of Wire Lang syntax and semantics used by parsing, compilation, and models.
_Avoid_: package version, renderer version

## Relationships

- **Wire Lang** source is written in **Wire Files**.
- **Mermaid** is the main product reference for Wire Lang's authoring and documentation workflow, not a dependency or syntax compatibility target.
- **Wire Files** are **UTF-8 Source**.
- A **Schematic** describes the logical structure of an electronic circuit.
- A **Schematic** may contain multiple **Disconnected Subschematics**.
- A **Schematic** contains one or more **Component Instances**.
- A **Component Statement** declares a **Component Instance**.
- A **Component Instance** has exactly one **Instance ID**.
- **Instance IDs** and **Component Group** names share the **Target Name** namespace.
- A **Component** exposes one or more **Terminals**.
- A **Component** is rendered using a **Schematic Symbol**.
- Standard **Schematic Symbols** follow an IEC-style **Symbol Style Profile** where practical without claiming formal standards compliance.
- A **Schematic Symbol** can define **Symbol Terminal Roles**.
- A component type using a **Schematic Symbol** with roles must define a **Symbol Terminal Mapping**.
- A **Module** is a **Component** rendered using a **Module Symbol** by default.
- A **Module Symbol** is the MVP fallback for local components that do not use a specialized built-in **Schematic Symbol**.
- A **Module Symbol** uses **Module Pin Layout** to place exposed terminals deterministically.
- A **Standard Component Library** defines known **Components**, their terminal names, accepted aliases, properties, and default **Schematic Symbols**.
- A **Local Component Definition** has precedence over the **Standard Component Library** when both define the same component type.
- A **Local Component Definition** is written as a **Definition Block**.
- A **Source Document** should prefer **Canonical Names**, while aliases may be accepted and normalized.
- A **Component Instance** can have **Electrical Properties**.
- A component type defines **Property Types** for its **Electrical Properties**.
- A component type may define **Recommended Properties**.
- A **Component Instance** may preserve **Unknown Properties** for future tooling or plugins.
- An **Electrical Property** may contain a **Quantity**.
- An **Electrical Property** may preserve a **Display Label** for rendering.
- A component type may define **Default Property Labels**.
- A **Source Document** can include **Render Hints** that guide drawing without changing circuit meaning.
- **Render Hints** may be **Global Render Hints** or **Targeted Render Hints**.
- A **Source Document** can define **Component Groups** to guide layout.
- A **Group Statement** declares a **Component Group**.
- A **Component Instance** may belong to at most one **Component Group** in the MVP.
- **Auto Layout** is the default way to render a **Schematic**.
- **Stable Auto Layout** is required for documentation-friendly rendering.
- A **Schematic** contains one or more **Nets**.
- A **Net** may be a **Named Net** or an **Anonymous Net**.
- Repeated **Named Net** declarations with the same name are combined through **Net Merge**.
- A component terminal assigned to multiple different **Nets** creates a **Net Conflict**.
- A **Connect Statement** creates an **Anonymous Net**.
- A **Floating Net** is valid source but should produce a warning **Diagnostic**.
- A **Power Net** is a **Net** with conventional electrical meaning, not a hidden global connection.
- A **Net** is rendered with zero or more **Visual Wires**.
- A **Junction Dot** marks an explicit visual connection between crossing or branching **Visual Wires**.
- A **Source Document** declares the **Components** and **Nets** that produce a **Schematic**.
- A **Wire File** contains exactly one **Source Document** in the MVP.
- A **Source Document** starts with a **Document Kind**.
- A **Source Document** may contain **Line Comments**.
- A **Source Document** may contain **Annotations** that render visible explanatory text.
- A **Source Document** may define a **Schematic Title** and **Schematic Description**.
- A **Source Document** is parsed and normalized into a **Schematic Model** before layout or rendering.
- **Reference Resolution** links component and terminal references after all declarations are parsed.
- A **Schematic Model** contains only resolved component types used by the document.
- A **Layout Model** is generated from a **Schematic Model** before the **SVG Renderer** runs.
- A **Layout Model** uses **Layout Units** rather than renderer-specific pixels.
- The **SVG Renderer** emits stable **SVG Metadata** for rendered components, nets, and annotations.
- The **SVG Renderer** produces **Standalone SVG** by default.
- **Theme Styling** is applied through SVG/CSS rather than schematic source syntax in the MVP.
- The initial product is a **JavaScript Library** with programmatic rendering APIs and a minimal **Developer CLI**.
- **DOM Auto Render** is a post-MVP follow-up for Mermaid-style documentation embedding.
- The MVP **JavaScript Library** exposes a **Parse API**, **Compile API**, and **Render API**.
- The MVP supports an **Agent Authoring Workflow** through the **Developer CLI**.
- The **Developer CLI** exposes a **Check Command**, **Render Command**, and **Watch Command**.
- The **Developer CLI** emits **Human Diagnostic Output** by default and **Machine Diagnostic Output** when requested.
- A **Headless Language Server** is a post-MVP follow-up that can reuse the parser and validation foundation.
- Parsing and normalization return **Diagnostics** and **Authoring Feedback** for source problems.
- The MVP **Standard Component Library** includes basic passive components, basic semiconductors, power/reference components, switches, connectors/modules, and BJT transistors.

## MVP Standard Component Library

**Resistor**:
Terminals `1`, `2`; recommended `value: resistance`; default labels `id`, `value`; symbol `resistor`.

**Capacitor**:
Terminals `1`, `2`; recommended `capacitance: capacitance`; default labels `id`, `capacitance`; symbol `capacitor`.

**PolarizedCapacitor**:
Terminals `+`, `-`; recommended `capacitance: capacitance`; default labels `id`, `capacitance`; symbol `polarized-capacitor`.

**Inductor**:
Terminals `1`, `2`; recommended `inductance: inductance`; default labels `id`, `inductance`; symbol `inductor`.

**Diode**:
Terminals `A`, `C`; default label `id`; symbol `diode`; maps `anode` to `A` and `cathode` to `C`.

**LED**:
Terminals `A`, `C`; optional `color: enum(red, green, blue, yellow, white, amber)`; default label `id`; symbol `led`; maps `anode` to `A` and `cathode` to `C`.

**NPNTransistor**:
Terminals `C`, `B`, `E`; default label `id`; symbol `npn-transistor`; maps `collector` to `C`, `base` to `B`, and `emitter` to `E`.

**PNPTransistor**:
Terminals `C`, `B`, `E`; default label `id`; symbol `pnp-transistor`; maps `collector` to `C`, `base` to `B`, and `emitter` to `E`.

**Battery**:
Terminals `+`, `-`; recommended `voltage: voltage`; default labels `id`, `voltage`; symbol `battery`; maps `positive` to `+` and `negative` to `-`.

**GroundReference**:
Terminal `GND`; no default label; symbol `ground-reference`; maps `reference` to `GND`.

**SPSTSwitch**:
Terminals `1`, `2`; optional `state: enum(open, closed)`; default label `id`; symbol `spst-switch`.

**PushButton**:
Terminals `1`, `2`; optional `normally: enum(open, closed)`; default label `id`; symbol `push-button`.

**Header**:
Terminals are user-defined through recommended `pins: pin-list`; default label `id`; symbol `module`.

**FerriteBead**:
Terminals `1`, `2`; no properties; default label `id`; symbol `ferrite-bead`; designators `FB`/`L`.

**TVSDiode**:
Terminals `A`, `C`; optional `bidirectional: boolean`; default label `id`; symbol `tvs-diode`; maps `anode` to `A` and `cathode` to `C`; designators `D`/`TVS`.

**Speaker**:
Terminals `+`, `-`; no properties; default label `id`; symbol `speaker`; maps `positive` to `+` and `negative` to `-`; designators `LS`/`SP`.

**Antenna**:
Terminal `1`; no properties; default label `id`; symbol `antenna`; designators `ANT`/`E`.

**TestPoint**:
Terminal `1`; optional `name: string`; default labels `id`, `name`; symbol `test-point`; designator `TP`.

**PTC**:
Terminals `1`, `2`; no properties; default label `id`; symbol `ptc`; designators `F`/`RT`. The resettable-fuse / polyfuse variant; the plain fuse is tracked separately.

**PowerFlag**:
Terminal `1`; recommended `name: string` (e.g. `VBAT`, `5V`, `3V3`, `VCC`) drawn inside the flag; no default label; symbol `power-flag`; designators `PWR`/`PR`/`PF`. A visual rail flag, not a hidden global net.

**IC**:
Terminals are user-defined through recommended `pins: ic-pin-list` written as `pins=[number:name@side, ...]`; default label `id`; symbol `ic`; designators `U`/`IC`.

## Example dialogue

> **Dev:** "Should this diagram show the exact breadboard rows used by the LED circuit?"
> **Domain expert:** "No. The first target is a **Schematic**: show the LED, resistor, power, ground, and their electrical connections clearly."
>
> **Dev:** "Can one schematic contain two disconnected circuit islands?"
> **Domain expert:** "Yes. They render as **Disconnected Subschematics** in stable source order, with a warning if appropriate."
>
> **Dev:** "If a power net renders as labels instead of continuous wires, are those components electrically disconnected?"
> **Domain expert:** "No. **Disconnected Subschematics** are determined from the normalized **Nets**, not from the visual wire style."
>
> **Dev:** "Can the renderer automatically turn long nets into labels?"
> **Domain expert:** "Not in the MVP. Nets render as wires by default; use `render net NAME style=label` for explicit label rendering."
>
> **Dev:** "Is the line between the resistor and LED a wire?"
> **Domain expert:** "Visually yes, but electrically it is part of a **Net** shared by the connected terminals."
>
> **Dev:** "Is the LED symbol the LED itself?"
> **Domain expert:** "No. The LED is the **Component**; the diode-with-arrows drawing is its **Schematic Symbol**."
>
> **Dev:** "Are Wire Lang symbols officially IEC 60617 compliant?"
> **Domain expert:** "No. Standard symbols use an IEC-style **Symbol Style Profile** where practical, but Wire Lang should not claim formal IEC compliance or copy a standards catalog."
>
> **Dev:** "Should an Arduino Uno render as its full internal circuit?"
> **Domain expert:** "Not in the MVP. Complex board modules can be represented later as **Module Symbols** with exposed terminals; internal expansion is a future capability."
>
> **Dev:** "Should every module use one generic terminal layout?"
> **Domain expert:** "In the MVP, generic modules use deterministic **Module Pin Layout** and preserve declared terminal order."
>
> **Dev:** "Should users primarily describe circuits by drawing connection paths?"
> **Domain expert:** "No. The **Source Document** should be declarative, similar in spirit to Mermaid chart definitions, with visual-path shorthand left as a possible future convenience."
>
> **Dev:** "Why does the document start with `schematic`?"
> **Domain expert:** "`schematic` is the **Document Kind**; it leaves room for future document kinds while making the current source explicit."
>
> **Dev:** "Do users need to write a version after `schematic`?"
> **Domain expert:** "Not in the MVP. **Language Version** is tracked in APIs and models, but the source starts with `schematic` only."
>
> **Dev:** "What file extension should examples use?"
> **Domain expert:** "Use `.wire`; a **Wire File** contains one **Source Document**."
>
> **Dev:** "Can users write `220Ω` or accented annotation text?"
> **Domain expert:** "Yes. **Wire Files** are **UTF-8 Source**, though canonical examples may prefer ASCII aliases such as `220ohm` for AI-friendly generation."
>
> **Dev:** "What language tag should Markdown examples use?"
> **Domain expert:** "Use `wire` as the **Markdown Fence** tag; direct Markdown processing is outside the core MVP."
>
> **Dev:** "Should syntax highlighting ship in the MVP?"
> **Domain expert:** "No. A **VS Code Extension** should be prioritized shortly after the MVP, using the public parse and diagnostics APIs."
>
> **Dev:** "Should the MVP ship a language server like TypeScript?"
> **Domain expert:** "No. The MVP feedback loop is the **Developer CLI**; a **Headless Language Server** is the next editor-facing step after the MVP."
>
> **Dev:** "Can one `.wire` file contain multiple schematics?"
> **Domain expert:** "Not in the MVP. A **Wire File** contains exactly one **Source Document**."
>
> **Dev:** "Can source include explanatory comments?"
> **Domain expert:** "Yes. A **Line Comment** starts with `//` and has no schematic meaning."
>
> **Dev:** "Should a `// Status LED` comment appear in the diagram?"
> **Domain expert:** "No. Use an **Annotation** for visible explanatory text; comments remain source-only."
>
> **Dev:** "Can a component use `label=\"current limit\"` for extra visible text?"
> **Domain expert:** "Not in the MVP. Use an **Annotation** for visible free text near a component."
>
> **Dev:** "How does an annotation choose where to appear?"
> **Domain expert:** "An **Annotation** uses an **Annotation Target**, such as `near D1` or `near net VCC`."
>
> **Dev:** "How does the generated SVG describe itself to assistive technology?"
> **Domain expert:** "Use the **Schematic Title** and **Schematic Description** to populate accessible SVG title and description elements."
>
> **Dev:** "Can users write `LED1.anode` instead of `LED1.A`?"
> **Domain expert:** "Yes, if the **Component Library** defines `anode` as an alias, but it should normalize to the **Canonical Name** `A`."
>
> **Dev:** "Are `Resistor` and `resistor` automatically the same component type?"
> **Domain expert:** "No. **Canonical Names** are case-sensitive; aliases may define lowercase or alternate spellings explicitly."
>
> **Dev:** "What happens if the source defines its own `LED` component?"
> **Domain expert:** "The **Local Component Definition** wins for that **Source Document**; the built-in `LED` from the **Standard Component Library** is shadowed."
>
> **Dev:** "Can applications pass their own component library through the API in the MVP?"
> **Domain expert:** "No. A **Custom Component Library** is outside the MVP; use the **Standard Component Library** plus **Local Component Definitions**."
>
> **Dev:** "Does indentation define where a local component definition ends?"
> **Domain expert:** "No. A **Definition Block** is closed with `end`; indentation is for readability only."
>
> **Dev:** "Is `R1` the resistor type?"
> **Domain expert:** "No. `R1` is the **Instance ID** of a **Component Instance** whose component type is `Resistor`."
>
> **Dev:** "Is a local `define component SoilSensor` the same as `component S1 SoilSensor`?"
> **Domain expert:** "No. A **Local Component Definition** defines a component type; a **Component Statement** creates a **Component Instance**."
>
> **Dev:** "Can users declare `R1: Resistor` instead of `component R1 Resistor`?"
> **Domain expert:** "Not in the MVP. A **Component Statement** starts with the `component` keyword."
>
> **Dev:** "Can a local LED definition expose a terminal named `juninho`?"
> **Domain expert:** "Yes. Terminal names are defined by the component type; standard components use conventional names, but local definitions may choose their own **Canonical Names**."
>
> **Dev:** "How does the LED symbol know whether `juninho` is the anode or cathode?"
> **Domain expert:** "The component definition provides a **Symbol Terminal Mapping** from its terminal names to the LED symbol's **Symbol Terminal Roles**."
>
> **Dev:** "Can users draw a completely new symbol in the MVP?"
> **Domain expert:** "No. **Custom Symbol Definitions** are outside the MVP; local components can use built-in symbols or the generic **Module Symbol**."
>
> **Dev:** "Can a local module define no terminals?"
> **Domain expert:** "Yes, but it is a **Recoverable Validation Issue**. The module can render as a block, while references to nonexistent terminals remain fatal."
>
> **Dev:** "Is `orientation=vertical` part of the resistor?"
> **Domain expert:** "No. `value=220ohm` is an **Electrical Property**; `orientation=vertical` is a **Render Hint**."
>
> **Dev:** "Are all component properties just strings?"
> **Domain expert:** "No. Component definitions declare **Property Types**, such as quantity, enum, boolean, or string."
>
> **Dev:** "Is `component R1 Resistor` invalid because it has no value?"
> **Domain expert:** "No. Missing **Recommended Properties** produce warning diagnostics but should not block rendering."
>
> **Dev:** "Is `component R1 Resistor banana=123` invalid?"
> **Domain expert:** "No. `banana` is an **Unknown Property**: preserve it for tooling, but emit a warning diagnostic."
>
> **Dev:** "Should `10k` remain just a string?"
> **Domain expert:** "No. Unit-bearing properties should normalize to **Quantities** while preserving useful display labels."
>
> **Dev:** "If a resistor is written as `10k`, should the SVG show `10000ohm`?"
> **Domain expert:** "Not by default. The normalized value is a **Quantity**, while the rendered text can use the original or formatted **Display Label**."
>
> **Dev:** "How does the renderer know whether to show `220ohm` on a resistor?"
> **Domain expert:** "The component type defines **Default Property Labels**, such as showing `value` for resistors and `voltage` for batteries."
>
> **Dev:** "Should labels be converted to vector paths?"
> **Domain expert:** "No. Labels and annotations render as **SVG Text Labels** so they remain selectable, accessible, and styleable."
>
> **Dev:** "Should users place components using exact coordinates?"
> **Domain expert:** "Not in the MVP. **Auto Layout** should place components by default, with only high-level **Render Hints** for guidance."
>
> **Dev:** "What render hints are available first?"
> **Domain expert:** "The MVP supports direction, orientation, side, center anchor, and wire-or-label net style hints."
>
> **Dev:** "How does a render hint target a net instead of a component or group?"
> **Domain expert:** "Use `render net NAME ...` for nets, `render TARGET ...` for components or groups, and `render direction=...` for global hints."
>
> **Dev:** "What is the default layout direction?"
> **Domain expert:** "`left-to-right` is the default global render direction."
>
> **Dev:** "What happens with duplicate or unresolvable render hints?"
> **Domain expert:** "They are **Recoverable Validation Issues**: emit warning diagnostics, ignore unresolved targets, and use the last value for duplicate global hints."
>
> **Dev:** "Can auto-layout produce a very different diagram after a small source edit?"
> **Domain expert:** "It should avoid that where practical. **Stable Auto Layout** uses deterministic ordering, source order, instance IDs, and render hints to reduce unnecessary visual churn."
>
> **Dev:** "Should the layout minimize wire crossings at all costs?"
> **Domain expert:** "No. The **Layout Priority** is render hints, stability, source order, crossing reduction, then compactness."
>
> **Dev:** "How can a user tell the renderer that switches are inputs and LEDs are outputs?"
> **Domain expert:** "Use **Component Groups** with simple render hints, such as placing inputs on the left and outputs on the right."
>
> **Dev:** "Should group placement be declared inside the group?"
> **Domain expert:** "No. Use a **Group Statement** like `group Inputs: S1, R1`, then a separate render hint such as `render Inputs side=left`."
>
> **Dev:** "Can a component instance and group have the same name?"
> **Domain expert:** "No. They share the **Target Name** namespace so render hints are not ambiguous."
>
> **Dev:** "Can a net have the same name as a component?"
> **Domain expert:** "Yes. Nets have their own **Name Namespace** and are targeted with `render net NAME`."
>
> **Dev:** "Can `R1` belong to both `Inputs` and `Pullups`?"
> **Domain expert:** "Not in the MVP. **Component Groups** guide layout, so each **Component Instance** can belong to at most one group."
>
> **Dev:** "Does `GND` mean the renderer should replace every ground connection with isolated ground symbols?"
> **Domain expert:** "No. `GND` is a **Power Net** and should still be drawn with **Visual Wires** when that makes the circuit easier to read."
>
> **Dev:** "Does a `GND` net automatically create a ground-reference component?"
> **Domain expert:** "No. `GND` is a **Power Net**; use an explicit `GroundReference` component when a ground-reference symbol is part of the schematic."
>
> **Dev:** "How does a header define its terminals?"
> **Domain expert:** "Use `pins=[...]`, such as `component J1 Header pins=[1,2,3,4]` or `component J2 Header pins=[VCC,GND,SDA,SCL]`."
>
> **Dev:** "How does the SVG show whether crossing wires are connected?"
> **Domain expert:** "Use a **Junction Dot** for an explicit connection; crossing wires without a dot are not connected."
>
> **Dev:** "Does every connection need a source-level net name?"
> **Domain expert:** "No. Important or reused connections should be **Named Nets**; simple unnamed connections can become **Anonymous Nets**."
>
> **Dev:** "How do users declare an unnamed connection?"
> **Domain expert:** "Use a **Connect Statement**, such as `connect R1.2, D1.A`."
>
> **Dev:** "Is `net BASE: Q1.B` invalid?"
> **Domain expert:** "No. It creates a **Floating Net**, which is allowed but should produce a warning **Diagnostic**."
>
> **Dev:** "What happens if `net VCC:` appears twice?"
> **Domain expert:** "The declarations are combined through **Net Merge** into one logical **Named Net**."
>
> **Dev:** "What if `R1.1` appears in both `net A:` and `net B:`?"
> **Domain expert:** "That is a **Net Conflict**, because one terminal cannot belong to two different logical nets."
>
> **Dev:** "Should a voltmeter component calculate voltage in the MVP?"
> **Domain expert:** "No. Electrical simulation and measurement behavior belong in a future **Simulation Plugin**, not the initial schematic renderer."
>
> **Dev:** "Should the MVP manage manufacturer part numbers and supplier prices?"
> **Domain expert:** "No. Bill-of-materials behavior belongs in a future **BOM Plugin**."
>
> **Dev:** "Should the renderer draw directly from parsed source?"
> **Domain expert:** "No. The source should become a renderer-independent **Schematic Model**, then a **Layout Model**, then SVG."
>
> **Dev:** "Are layout coordinates SVG pixels?"
> **Domain expert:** "No. The **Layout Model** uses abstract **Layout Units**; the renderer scales them into SVG coordinates."
>
> **Dev:** "Can consumers style or inspect a rendered resistor in the SVG?"
> **Domain expert:** "Yes. The **SVG Renderer** should emit stable **SVG Metadata** such as `data-wire-kind`, `data-wire-id`, and classes."
>
> **Dev:** "Does generated SVG require external CSS?"
> **Domain expert:** "No. The default output is **Standalone SVG**, with external styling as an option for integrations."
>
> **Dev:** "Can a component link directly to a datasheet in the MVP?"
> **Domain expert:** "No. **Interactive Links** are outside the MVP, but **SVG Metadata** should make them easy to add later."
>
> **Dev:** "Should `.wire` files include `theme dark` or per-element CSS?"
> **Domain expert:** "Not in the MVP. Use **Theme Styling** through SVG classes and CSS custom properties."
>
> **Dev:** "Should the first release be CLI-first like a compiler?"
> **Domain expert:** "No. The core product remains a **JavaScript Library**, but the MVP includes a minimal **Developer CLI** so coding agents and developers can check `.wire` files and render SVG from the terminal."
>
> **Dev:** "What commands does the first CLI need?"
> **Domain expert:** "The MVP needs a **Check Command**, **Render Command**, and **Watch Command** to support the **Agent Authoring Workflow**."
>
> **Dev:** "Should Codex parse terminal text to understand diagnostics?"
> **Domain expert:** "No. The **Developer CLI** should show **Human Diagnostic Output** by default and provide **Machine Diagnostic Output** with JSON for agents and scripts."
>
> **Dev:** "How does browser auto-render find Wire Lang diagrams?"
> **Domain expert:** "After the MVP, **DOM Auto Render** should find **DOM Source Blocks** matching `pre.wire-lang` and `code.wire-lang`."
>
> **Dev:** "Should auto-render destroy the original source block?"
> **Domain expert:** "No. It should preserve the **DOM Source Block** and insert a separate **DOM Render Container** for the SVG."
>
> **Dev:** "What happens if `run()` is called twice?"
> **Domain expert:** "**DOM Auto Render** is idempotent by default; repeated calls do not duplicate rendered output, while an explicit force option may re-render."
>
> **Dev:** "What is the main API now that the MVP exposes AST?"
> **Domain expert:** "Use the **Parse API** for source-level feedback, the **Compile API** for `Source Document` to `Schematic Model`, and the **Render API** for source or model to SVG."
>
> **Dev:** "Does `renderSvg` return diagnostics?"
> **Domain expert:** "No. `renderSvg` is the happy-path **Render API**: it returns an SVG string or throws if rendering cannot complete."
>
> **Dev:** "How can callers inspect why `renderSvg` failed?"
> **Domain expert:** "`renderSvg` throws **WireLangError**, which contains structured **Diagnostics**."
>
> **Dev:** "Should parsing stop at the first unknown terminal?"
> **Domain expert:** "No. It should return structured **Diagnostics** so users and AI agents can fix multiple source issues in one pass."
>
> **Dev:** "Can tools rely on diagnostic messages as stable identifiers?"
> **Domain expert:** "No. Tools should rely on stable **Diagnostic Codes**; human-readable messages may evolve."
>
> **Dev:** "Can diagnostics suggest edits?"
> **Domain expert:** "Yes, but only with high-confidence **Suggested Fixes** such as canonical capitalization or alias replacement; they should not invent circuit intent."
>
> **Dev:** "Should every suspicious but renderable source condition require a product decision?"
> **Domain expert:** "No. Treat similar **Recoverable Validation Issues** as warning diagnostics by default."
>
> **Dev:** "What makes a source problem an error instead of a warning?"
> **Domain expert:** "A **Fatal Validation Issue** prevents a coherent schematic model or safe render; a **Recoverable Validation Issue** still renders and produces a warning."
>
> **Dev:** "Must components be declared before nets that mention them?"
> **Domain expert:** "No. **Reference Resolution** happens after parsing, so declaration order does not carry schematic meaning."
>
> **Dev:** "Does the MVP expose an AST API for editor tooling?"
> **Domain expert:** "Yes. The MVP includes a **Parse API** that returns a **Public AST** for valid source and a **Partial AST** with **Diagnostics** for invalid source."
>
> **Dev:** "Does the partial AST preserve every token and whitespace?"
> **Domain expert:** "No. The MVP **Partial AST** is structural and uses **Error Nodes** for invalid source fragments; it is not a lossless token-level tree."
>
> **Dev:** "Do source comments appear in the public AST?"
> **Domain expert:** "No. **Line Comments** have no schematic meaning and do not need to appear in the MVP **Public AST**."
>
> **Dev:** "How does an editor know what source range a component came from?"
> **Domain expert:** "Every relevant **Public AST** and **Partial AST** node carries a **Source Location**."

## Flagged ambiguities

- "circuit diagram" can mean **Schematic**, breadboard diagram, PCB layout, or simulation model; resolved: the first target is **Schematic**.
- "wire" can mean a physical cable, a drawn line, or an electrical connection; resolved: the electrical concept is **Net**, while the rendered line is **Visual Wire**.
- Complex board modules, such as Arduino boards, are outside the MVP; future support should render them as **Module Symbols** by default, with internal expansion left as a later capability.
- Generic modules preserve declared terminal order in a deterministic **Module Pin Layout**.
- The MVP does not include module-specific pin layouts.
- The language style could be declarative or path-oriented; resolved: the core **Source Document** style is declarative, similar in spirit to Mermaid chart definitions.
- Mermaid is the main product reference for the text-to-diagram workflow, but Wire Lang is not a Mermaid plugin and does not aim for Mermaid syntax compatibility.
- The initial supported **Document Kind** is `schematic`.
- The MVP tracks **Language Version** internally but does not require an explicit source-level version.
- Standard symbols use an IEC-style **Symbol Style Profile** where practical, but the project does not claim formal standards compliance in the MVP.
- The default file extension for a **Wire File** is `.wire`.
- **Wire Files** are UTF-8; Unicode is allowed in values, labels, and annotations.
- The recommended **Markdown Fence** tag is `wire`. Direct integration is
  outside the core MVP and is implemented by the build-time
  `@wire-lang/markdown` **Markdown Integration** package.
- Syntax highlighting and editor extensions are outside the MVP; a **Headless Language Server** and **VS Code Extension** are high-priority post-MVP follow-ups.
- A **Wire File** contains exactly one **Source Document** in the MVP.
- The MVP supports `//` **Line Comments** and does not need block comments.
- **Line Comments** do not need to appear in the MVP **Public AST**.
- Visible free text in a **Schematic** is represented by **Annotations**, not comments.
- MVP **Annotations** use `annotation "text" near TARGET`, where the target is a component instance or `net NAME`.
- Freeform component `label` properties are outside the MVP; use **Annotations** for visible explanatory text.
- The MVP supports **Schematic Title** and **Schematic Description** for documentation and accessible SVG output.
- Schematics with no components are allowed but produce warning diagnostics.
- Multiple **Disconnected Subschematics** are allowed and render separately in stable source order.
- AI-authored input should use **Canonical Names** wherever possible; aliases are accepted for user convenience and normalized before rendering or validation.
- **Canonical Names** are case-sensitive; aliases provide any desired lowercase or alternate spellings.
- The **Standard Component Library** provides built-in component definitions, but **Local Component Definitions** override matching standard component types within the same **Source Document**.
- **Custom Component Libraries** passed through the API are outside the MVP.
- Local definitions use `define ... end` **Definition Blocks**; indentation is not semantically significant.
- The **Public AST** and **Schematic Model** keep local component type definitions separate from component instances.
- The **Schematic Model** includes only component types used by the document, not the entire **Standard Component Library**.
- **Terminal** names are defined by the component type; standard components use conventional names, while local definitions can introduce arbitrary terminal names.
- A **Symbol Terminal Mapping** is required when a component type uses a **Schematic Symbol** that defines **Symbol Terminal Roles**.
- **Custom Symbol Definitions** are outside the MVP.
- Local components without specialized built-in symbols use the generic **Module Symbol** in the MVP.
- Local module components with no terminals are allowed with warning diagnostics.
- Every **Component Instance** must have a unique **Instance ID**.
- **Instance IDs** and **Component Group** names must not collide.
- **Name Namespaces** are separate for target names, net names, component type names, and terminal names within each component type.
- The exact identifier grammar is deferred, but conventional net names such as `5V` and `3V3` must be supported.
- **Component Statements** require the `component` keyword in the MVP.
- Conventional designator prefixes, such as `R` for resistors and `D` for LEDs, should produce warnings when mismatched rather than hard errors.
- **Electrical Properties** and **Render Hints** are separate concepts in the **Source Document**.
- **Electrical Properties** are validated against component-defined **Property Types**.
- Missing **Recommended Properties** produce warning **Diagnostics**, not errors, in the MVP.
- **Unknown Properties** produce warning **Diagnostics** and are preserved in the **Schematic Model**.
- MVP **Render Hints** are `direction`, `orientation`, `side`, `anchor=center`, and net `style=wire|label`.
- MVP render hint syntax is `render direction=...`, `render TARGET ...`, and `render net NAME ...`.
- The default global render direction is `left-to-right`.
- Duplicate or unresolvable render hints produce warning diagnostics; duplicate global hints use the last value.
- Unit-bearing **Electrical Properties** should normalize to **Quantities** in the **Schematic Model**.
- Unit-bearing properties may keep a **Display Label** so rendering does not have to expose normalized numeric form.
- Component types define **Default Property Labels** for properties shown in the SVG by default.
- Labels and annotations render as **SVG Text Labels**, not outlined text paths.
- The MVP uses **Auto Layout** by default and avoids absolute coordinates.
- The MVP requires **Stable Auto Layout**: deterministic output and local visual changes where practical.
- MVP **Layout Priority** is: render hints, stability, source order, crossing reduction, compactness.
- The MVP supports simple **Component Groups** to guide layout, without nested groups.
- **Group Statements** use `group Name: A, B, C`; group layout preferences use separate render hints.
- In the MVP, a **Component Instance** can belong to at most one **Component Group**.
- **Power Nets** are conventional **Nets**; labels and ground symbols are render choices, not the electrical meaning.
- Electrical connectivity is determined by **Nets**, not by whether a net renders as continuous wires or labels.
- A `GND` **Power Net** does not automatically create a `GroundReference` component.
- Nets render as **Visual Wires** by default; label rendering requires an explicit net render hint in the MVP.
- **Junction Dots** indicate explicit visual wire connections; crossing wires without a dot are not connected.
- The MVP supports both **Named Nets** and **Anonymous Nets**.
- Repeated **Named Net** declarations with the same name are merged during normalization.
- A **Net Conflict** is an error **Diagnostic**.
- **Connect Statements** are the MVP syntax for declaring **Anonymous Nets**.
- **Floating Nets** are allowed but should produce warning **Diagnostics**.
- Electrical simulation and measurement behavior are outside the MVP and may be added later through a **Simulation Plugin**.
- Bill-of-materials behavior is outside the MVP and may be added later through a **BOM Plugin**.
- The MVP renderer is an **SVG Renderer**.
- The **Layout Model** uses abstract **Layout Units**, and the **SVG Renderer** maps them to SVG coordinates.
- The **SVG Renderer** emits **Standalone SVG** by default, with external styling as an integration option.
- Canvas rendering may be added later, but SVG is the initial optimized target for documentation-style usage.
- The **SVG Renderer** should emit stable **SVG Metadata** using sanitized IDs, `data-wire-*` attributes, and classes.
- **Interactive Links** are outside the MVP.
- MVP visual theming uses **Theme Styling** through SVG classes and CSS custom properties, not `.wire` syntax.
- The MVP is a **JavaScript Library** with programmatic API and a minimal **Developer CLI**.
- **DOM Auto Render** is outside the MVP and remains a high-priority post-MVP follow-up.
- Post-MVP **DOM Auto Render** should use `wire-lang` as the default class for **DOM Source Blocks**.
- Post-MVP **DOM Auto Render** should preserve source blocks and insert separate **DOM Render Containers**.
- Post-MVP **DOM Auto Render** should be idempotent by default and may support explicit forced re-rendering.
- The MVP public APIs are `parse(source)`, `compile(source | ast)`, and `renderSvg(source | model)`.
- `renderSvg(source | model)` returns an SVG string on success and throws when rendering cannot complete.
- Happy-path APIs throw **WireLangError** with structured **Diagnostics** when they cannot complete.
- The MVP is not CLI-first, but it includes a minimal **Developer CLI** for the **Agent Authoring Workflow**.
- The MVP **Developer CLI** includes a **Check Command**, **Render Command**, and **Watch Command**.
- The MVP **Developer CLI** uses **Human Diagnostic Output** by default and supports **Machine Diagnostic Output** through JSON.
- The MVP does not ship a **Headless Language Server**; it remains a post-MVP follow-up.
- Parser and normalizer APIs should return structured **Diagnostics** and **Authoring Feedback** rather than only throwing the first error.
- **Diagnostics** include stable **Diagnostic Codes** organized by area, such as parse, reference, net, component, and render.
- **Recoverable Validation Issues** produce warning **Diagnostics** by default.
- **Fatal Validation Issues** produce error **Diagnostics**.
- **Diagnostics** may include **Suggested Fixes** only for mechanical, high-confidence corrections.
- `Header` uses `pins=[...]` to define its terminals in the MVP.
- Declaration order does not carry schematic meaning; unresolved references are reported during **Reference Resolution**.
- The MVP includes a **Public AST** and **Partial AST** to support high-quality editor and AI feedback.
- The MVP **Partial AST** is structural and uses **Error Nodes**; it is not a lossless token-level AST.
- MVP **Public AST** and **Partial AST** nodes carry **Source Locations**.
- The MVP **Standard Component Library** should include `Resistor`, `Capacitor`, `PolarizedCapacitor`, `Inductor`, `LED`, `Diode`, `NPNTransistor`, `PNPTransistor`, `Battery`, `GroundReference`, `SPSTSwitch`, `PushButton`, `Header`, `FerriteBead`, `TVSDiode`, `Speaker`, `Antenna`, `TestPoint`, `PTC`, `PowerFlag`, and `IC`.
- A **No-Connect Flag** (`no-connect TERMINAL`) marks a terminal as intentionally unconnected; it renders as an `X` and conflicts with assigning that terminal to a **Net**.
- A **Wire Hop** is drawn by default where **Visual Wires** cross without a junction (`crossings=hop`); `render crossings=gap` opts out and leaves crossings overlapping.
- An `IC` block declares pins as `pins=[number:name@side]`; the **Pin Number** and box side are optional, and an omitted side defaults to `left`.
- A **Power Flag** is a visual rail label, not a **Power Net** or hidden global connection.
- MOSFETs are out of scope for the MVP.
- Project documentation uses English canonical terms, while working conversation may happen in Portuguese.
