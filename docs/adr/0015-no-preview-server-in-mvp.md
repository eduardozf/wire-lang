# No Preview Server in MVP

Wire Lang's MVP will not include a `wire preview` command or local preview server. We chose this because the first agent/developer loop only needs `wire render` and `wire watch` to produce an SVG file that can be opened directly, while a live preview server would add another runtime surface before the core parser, diagnostics, layout, and renderer have stabilized.
