# JavaScript Library with SVG Renderer

Wire Lang will start as a JavaScript/TypeScript library that parses textual schematic source and renders SVG diagrams through a renderer-independent schematic and layout model. We chose this over a Canvas-first renderer or CLI-first tool because the primary use case is documentation-style embedding similar to Mermaid, where SVG is portable, inspectable, and crisp at any scale; Canvas and CLI support can be added later as secondary layers.
