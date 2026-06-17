# Browser Auto Render Post-MVP

Wire Lang's MVP will not ship browser auto-render or `@wire-lang/browser`; the first release focuses on the core library and developer CLI feedback loop. We chose this over including Mermaid-style `run()` immediately because the initial user workflow is coding-agent driven: write `.wire`, run `wire check`, run `wire render`, and inspect the SVG file; browser auto-render remains a high-priority post-MVP integration once the language, diagnostics, layout, and renderer stabilize.
