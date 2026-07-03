# MVP Boundaries For Users

Use this when a user asks Wire Lang to express something outside the MVP.

## In Scope

- Textual `.wire` source files.
- Logical electronic schematics.
- Components, terminals, named nets, anonymous connections, annotations, groups,
  and render hints.
- Local module-style components.
- Documentation-friendly SVG output.

## Out Of Scope

- Electrical simulation.
- Voltage/current calculation.
- Breadboard row placement.
- PCB footprints, routing, or manufacturing output.
- BOM generation.
- Custom symbol drawing language.
- Canvas rendering.
- Browser auto-render.
- Markdown processing.
- Headless language server.
- VS Code extension.
- Complex standard-library board modules such as Arduino or ESP32.

## How To Respond

- If the user asks for simulation, say Wire Lang MVP can document the schematic
  but cannot calculate behavior.
- If the user asks for breadboard or PCB layout, produce a logical schematic
  instead.
- If the user asks for an unsupported component, use a local `define component`
  module when the terminals are known.
- If the user asks for a custom visual symbol, use `symbol module` in the MVP.
- If the user asks for a Markdown-rendered diagram, say Markdown `wire` fences
  do not auto-render in the MVP; author `.wire`, run `wire render`, then link or
  embed the generated SVG.
