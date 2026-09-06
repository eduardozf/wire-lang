# ADR 0020: Browser rendering by default with static rendering opt-in

## Status

Accepted. Supersedes the build-time default in ADR 0019 and implements the
post-MVP browser scope from ADR 0016.

## Context

Authors want to place `wire` fences in Markdown and have a site render them
after HTML loads, following Mermaid's browser integration style. Static output
remains useful for pages that need diagrams without client JavaScript.

## Decision

Provide `@wire-lang/browser` with asynchronous `initialize`, `run`, and `render`
APIs. Initialization waits for HTML readiness and discovers standard Markdown
code blocks plus explicit `wire-lang` blocks. Preserve source in hidden elements
and insert separate rendered containers. Serialize discovery calls so overlapping
initialization and manual calls cannot duplicate output. Report individual block
errors without stopping the remaining diagrams.

Keep core's synchronous, DOM-independent renderer. The browser wrapper yields
before rendering each diagram and bundles core into standalone ESM. This makes
script-tag imports possible without a bundler, but does not move layout work
into a worker. Imports do not initialize automatically.

Markdown plugins default to browser mode and preserve source nodes. Users opt
into ahead-of-time SVG with `{ mode: "static" }`. Retain structured SVG insertion
and original Markdown diagnostic mapping for that static path.

## Consequences

- Browser mode requires site initialization and downloads the renderer. Without
  JavaScript, source blocks remain visible.
- Ordinary Markdown processors need no Wire plugin when they retain standard
  `language-wire` blocks. Plugin configuration alone never injects a script.
- Applications call `run()` after navigation or content updates, and after
  framework hydration. Mutation observation and framework lifecycle adapters
  are not included.
- Static mode adds compilation work during the build and needs no client runtime.
- Source errors surface during browser rendering by default, or during the build
  in static mode. The underlying SVG drawing is identical in both modes.
