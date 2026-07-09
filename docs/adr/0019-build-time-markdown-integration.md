# ADR 0019: Build-time Markdown integration with structured inline SVG

## Status

Accepted.

## Context

Wire Lang's Mermaid-style documentation workflow needs fenced code blocks tagged
`wire` to render inside Markdown and MDX. The integration could render in the
browser at page load, during each server request, or while the document is
built. It also needs to compose with both sides of the unified ecosystem:
remark's Markdown AST and rehype's HTML AST.

Emitting generated SVG as raw HTML would require downstream processors to opt
into dangerous/raw HTML handling and would make plugin ordering and sanitizing
harder to reason about.

## Decision

Publish `@wire-lang/markdown` with two build-time plugins:

- `remarkWire` replaces Markdown `code` nodes whose language is exactly `wire`.
- `rehypeWire` replaces standard `pre > code.language-wire` HAST blocks and is
  the direct MDX integration.

Both render with `@wire-lang/core`, parse the renderer-owned SVG into structured
HAST, and insert the `<svg>` element in place of the source block. Fatal Wire
diagnostics fail the document build as VFile messages mapped to the fence's
location in the containing document.

Build time is the documented default because it ships no compiler JavaScript to
the browser and catches invalid diagrams before deployment. Request-time server
processing may use the same plugins. Browser auto-render remains a separate
future `@wire-lang/browser` concern; applications that need it immediately can
call `renderSvg` and manage DOM insertion themselves.

## Consequences

- Markdown, rehype, and MDX users share one package and one `wire` fence
  convention.
- Generated SVG is visible to later HAST plugins without enabling arbitrary raw
  HTML.
- Sanitizers can run before `rehypeWire`; a sanitizer after `remarkWire` needs an
  SVG-aware schema.
- Rendering is synchronous and adds Wire compilation work to document builds or
  server requests.
- Client-side updates are not automatic and remain outside this package.
