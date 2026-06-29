# Agent Instructions

This repository includes an Agent Skills-compatible user skill at
`skills/wire-lang/SKILL.md`.

Use that skill when helping someone write, revise, explain, or troubleshoot
Wire Lang `.wire` source. The skill is for Wire Lang users and source authoring;
it is not the development guide for implementing the compiler or renderer.

Keep the project documented as you work. When behavior, vocabulary, scope, or
architecture changes, update the relevant source-of-truth document in the same
change:

- `docs/CONTEXT.md` for domain vocabulary and resolved terminology.
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

## Pull Requests

When a PR changes rendered output — layout, symbols, SVG, anything an author
would see differently — include before/after images in the PR description.
PRs with no visual diff (docs, tooling, refactors, CI, internal APIs) do not
need them.

Produce each image with the bundled SVG renderer so it reflects real output, not
a mockup: render the same `.wire` source on `main` (before) and on the branch
(after) and place them side by side, `main` on the left. `scripts/wire-to-png.mjs`
rasterizes a `.wire` file to PNG via `@resvg/resvg-js` and is a good starting
point. Choose small, focused schematics that isolate the change, and prefer a
few cases over one busy diagram (e.g. each direction a hint can move, plus a
no-op case).

Host the images on a throwaway `demo/<topic>-assets` branch under
`docs/assets/<topic>/`, pushed separately, and reference them in the PR body by
raw URL (`https://raw.githubusercontent.com/<owner>/wire-lang/demo/<topic>-assets/...`).
Keeping them off the feature branch keeps binary assets out of the PR's diff and
out of `main`. Note in the PR that the images live on that branch.
