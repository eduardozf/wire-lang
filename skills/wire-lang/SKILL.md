---
name: wire-lang
description: Create, revise, and explain Wire Lang .wire schematic source. Use when writing electronic schematics, converting circuit descriptions into Wire Lang, fixing Wire Lang syntax, or giving good and bad examples of Wire Lang authoring.
license: MIT
---

# Wire Lang Authoring Skill

Use this skill to help people author Wire Lang source. Wire Lang is a textual
language for describing electronic schematics and rendering them as readable SVG
diagrams.

## First Move For Authoring

1. Identify the circuit the user wants to describe.
2. Choose component instances and stable instance IDs.
3. Connect terminals through named nets or `connect` statements.
4. Add title, description, annotations, and render hints only when useful.
5. Check the source with `wire check` when the CLI is available.

Read the focused reference files as needed:

- `references/concept-map.md` for the authoring concept graph.
- `references/source-format.md` for syntax and statement shapes.
- `references/component-library.md` for standard components, terminals, and
  properties.
- `references/style-guide.md` for source-writing conventions.
- `references/examples.md` for good and bad examples.
- `references/boundaries.md` when a user asks for simulation, PCB layout,
  breadboard layout, BOMs, custom symbols, or browser/editor integrations.

## Validate And Render

Use the `wire` CLI instead of hand-validating whenever the user's environment
can run it:

```bash
npm i -D wire-lang
npx wire check path/to/circuit.wire
npx wire render path/to/circuit.wire --out path/to/circuit.svg
npx wire watch path/to/circuit.wire --out path/to/circuit.svg
```

For a one-off run without adding a package to the project, invoke the `wire`
binary from the `wire-lang` package:

```bash
npx -p wire-lang wire check path/to/circuit.wire
npx -p wire-lang wire render path/to/circuit.wire --out path/to/circuit.svg
```

- Use `wire check` as the real implementation of checking the source against
  MVP syntax and the component library.
- Use `wire render <file>.wire --out <file>.svg` as the canonical author-to-SVG
  artifact step.
- Use `wire watch <file>.wire --out <file>.svg` while iterating.
- Add `--json` to `wire check`, `wire render`, or `wire watch` when
  machine-readable diagnostics are useful.
- Markdown does not auto-render fenced `wire` blocks in the MVP. The intended
  documentation workflow is: author `.wire` -> run `wire render` -> link or
  embed the generated `.svg`.
- Do not claim that source was checked or rendered unless the command actually
  ran. If the CLI is unavailable, say the source is not tool-validated and give
  the exact command to run.

## Authoring Rules

- Start every MVP source with `schematic`.
- Use `.wire` source to describe logical schematics, not breadboards, PCB
  layouts, physical routing, or simulations.
- Declare component instances with `component ID Type ...`.
- Use canonical component names and terminal names from the standard library.
- Use named nets for important or reused electrical nodes such as `VCC`, `5V`,
  `3V3`, `GND`, `SDA`, or `SCL`.
- Use `connect` for simple anonymous connections.
- Treat power nets as normal nets; they do not create hidden connections.
- Use `annotation` for visible explanatory text. Use `//` only for source
  comments.
- Use render hints for layout guidance, not electrical meaning.
- Do not invent unsupported syntax. If Wire Lang cannot express the user's
  request in the MVP, say so and offer the closest valid source.

## Default Output

When asked to create Wire Lang source, return a complete `.wire` block:

```wire
schematic
  title "..."
  description "..."

  component ...

  net ...
  connect ...
```

After the block, include a short note only for important assumptions, such as
component choices or unsupported requested behavior.

When the user asks for an image or SVG artifact, include the `wire render`
command to produce it. If you ran the command successfully, include the output
path; otherwise, state that rendering has not been tool-verified.

## Common Corrections

- "Draw a wire from X to Y" usually means create a `connect` statement or named
  `net`; do not encode visual paths.
- "Show this note in the diagram" means use `annotation`, not `//`.
- "Ground everything" still requires explicit `GND` net connections.
- "Make this vertical" is a render hint, not a component property.
- "Arduino board" is outside the MVP standard library; model it as a local
  module-style component if needed.
- "Chip with numbered pins" is the `IC` type: `pins=[1:VCC@left, 2:GND@left,
3:OUT@right]`. Connect pins by name.
- "Leave this pin unused / N.C." is a `no-connect TERMINAL` statement, not a
  floating net.
- "Mark the 3V3 rail" can use a `PowerFlag name=3V3`; it is a visual flag, not a
  hidden global net.
- Crossings without a junction are left simply overlapping by default; "draw a
  hop where lines cross" is `render crossings=hop`.

## Keep This Skill Current

When the Wire Lang syntax, examples, standard component library, or MVP authoring
rules change, update this skill and the focused reference files.

Before finishing an authoring response, check:

- The source starts with `schematic`.
- Component types and terminal names exist in the standard library or in a local
  component definition.
- Power nets are explicitly connected.
- Visible explanatory text uses `annotation`, not `//`.
- Render hints do not carry electrical meaning.
- Unsupported requests are called out with the closest valid MVP expression.
