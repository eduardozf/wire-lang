# Wire Lang Authoring Concept Map

This graph helps agents find the right authoring concept quickly. It is for
writing `.wire` source, not for developing the implementation.

## Graph

- Wire Lang source -> starts with -> `schematic`
- Source Document -> declares -> Component Instances
- Component Instance -> has -> Instance ID
- Component Instance -> has -> Component Type
- Component Type -> exposes -> Terminals
- Terminal references -> connect through -> Nets
- Named Net -> has -> source-level name
- Anonymous Net -> created by -> `connect`
- Render Hint -> guides -> layout
- Render Hint -> does not change -> electrical meaning
- Annotation -> renders -> visible text
- Line Comment -> remains -> source-only text
- Power Net -> is -> a conventional Named Net
- Power Net -> does not create -> hidden connections
- Schematic -> renders as -> SVG diagram

## High-Risk Distinctions

- Net is the electrical connection; visual wire is rendering output.
- Schematic is not breadboard layout, PCB layout, or simulation.
- Component Instance is not the same thing as a component type.
- Render Hint is not an electrical property.
- Annotation is visible in the diagram; line comment is not.
- Power nets such as `VCC` and `GND` are not magic globals.
