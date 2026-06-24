# Agent Instructions

This repository includes an Agent Skills-compatible user skill at
`skills/wire-lang/SKILL.md`.

Use that skill when helping someone write, revise, explain, or troubleshoot
Wire Lang `.wire` source. The skill is for Wire Lang users and source authoring;
it is not the development guide for implementing the compiler or renderer.

Keep the project documented as you work. When behavior, vocabulary, scope, or
architecture changes, update the relevant source-of-truth document in the same
change:

- `CONTEXT.md` for domain vocabulary and resolved terminology.
- `docs/MVP.md` for product scope, language semantics, APIs, diagnostics, and
  implementation contracts.
- `docs/adr/` for hard-to-reverse architectural decisions that would be
  surprising without context.
- `skills/wire-lang/` for user-facing authoring instructions, examples, and
  syntax guidance.

The symbol bench picker is derived from the standard library, so new component
types appear there automatically. When a type needs example props to render
meaningfully (e.g. `Header`/`IC` need a `pins=[...]` list), add a `SAMPLE_PROPS`
entry in `tools/symbol-bench/bench.js` in the same change.
