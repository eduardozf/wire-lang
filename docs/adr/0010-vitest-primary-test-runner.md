# Vitest Primary Test Runner

Wire Lang's MVP will use Vitest as the primary test runner for parser diagnostics, schematic model normalization, layout stability, SVG output, and CLI behavior. We chose this over Node's built-in test runner or Jest because Vitest fits TypeScript ESM packages well and gives a straightforward snapshot workflow for layout and SVG regression tests, while browser automation can be added later for DOM auto-render integration.
