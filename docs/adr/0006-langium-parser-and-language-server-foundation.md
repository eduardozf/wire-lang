# Langium Parser and Language Server Foundation

Wire Lang's MVP will use Langium as the parser and validation foundation, with the same grammar and validation model intended to support a future language server. We chose this over a hand-written parser, Lezer, Tree-sitter, or Chevrotain because the first workflow needs structured diagnostics for coding agents now, while preserving a direct path to TypeScript-like editor feedback later. The MVP feedback surface remains CLI-driven; a headless language server and VS Code extension are post-MVP follow-ups.
