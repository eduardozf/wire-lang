# Custom Deterministic Layout Engine

Wire Lang's MVP will use a custom deterministic layout engine rather than ELK, Dagre, D3 force layout, or manual coordinates. We chose this because stable schematic output is a core product promise, and electronic schematics need domain-specific conventions such as terminal sides, module pin order, rails, ground symbols, junction dots, and explicit label nets that generic graph layout libraries do not naturally optimize for.
