# Minimal Developer CLI for Agent Feedback

Wire Lang's MVP will include a minimal developer CLI with check, render, and watch commands, while keeping the core product a JavaScript/TypeScript library. We chose this over a library-only MVP because the first practical authoring workflow is expected to involve coding agents such as Codex or Claude Code writing `.wire` files, reading diagnostics, rendering SVG, and revising source in a tight feedback loop; a polished CLI product, web editor, and VS Code extension remain outside the MVP.
