# `@wire-lang/browser`

Render Wire Lang diagrams asynchronously after HTML is ready. This is the
default documentation workflow. To generate SVG ahead of time instead, use
[`@wire-lang/markdown`](../markdown) with `{ mode: "static" }`.

## Install and initialize

```bash
npm install @wire-lang/browser
```

Keep fenced `wire` blocks in your Markdown. Most Markdown processors produce
`<pre><code class="language-wire">...</code></pre>` for these blocks.
Load this code in your site's browser entry point:

```js
import wire from "@wire-lang/browser";

const result = await wire.initialize();
for (const { element, error } of result.errors) {
  console.error("Could not render Wire diagram", element, error);
}
```

`initialize()` waits for `DOMContentLoaded` if necessary, then renders once.
Importing the package does not start rendering. No Markdown plugin is required
when your processor already emits the standard `language-wire` class.

The published `dist/index.js` bundles the core renderer and has no external
JavaScript imports. You can also serve that file from your site and import it
in a `<script type="module">` without a bundler or import map.

## Discovery and source preservation

By default, `run()` finds:

```css
pre > code.language-wire, pre.wire-lang, code.wire-lang
```

A matching code element inside a `pre` uses that `pre` as its source container.
The runtime reads `textContent`, hides the source after a successful render,
and inserts a sibling `<div class="wire-lang-diagram">` containing the SVG.
Source stays in the DOM. Repeated and overlapping calls do not duplicate output.
Edited source is rendered again; `{ force: true }` also rerenders unchanged source.

```js
await wire.initialize({ startOnLoad: false });
await wire.run({ root: document.querySelector("main") });
await wire.run({ selector: "pre.circuit", force: true });
const svg = await wire.render(source);
```

`root` defaults to `document` and may be a document, element, or fragment. A root
that matches the selector is included. Run after a source element has a parent
so the runtime can insert its output. Discovery does not cross shadow roots;
pass the shadow root explicitly if needed.

Each call resolves to `{ rendered, errors }`. Invalid blocks retain their source
and get a `data-wire-error` attribute. Other diagrams still render. Errors include
the source element and the original error, with Wire diagnostics positioned
relative to the block contents. A failed rerender removes stale output. Inspect
`errors` to show an application-specific error message or log the diagnostics.
Invalid selectors and missing DOM context reject the call.

## Client navigation and timing

Call `run()` after client navigation or content insertion. For MDX rendered by
React, call it after hydration from a client effect. The runtime does not observe
DOM mutations or integrate with framework lifecycles automatically.

The asynchronous API yields to the event loop before rendering each diagram.
Compilation and layout of that diagram still run on the main thread; this is
not worker-based rendering. The browser downloads the compiler and renderer.
Choose static rendering for pages that should display diagrams without JavaScript.

Importing this module is safe during server rendering. DOM discovery requires
a document, while `render(source)` can also run in Node. The synchronous
`renderSvg` API in `@wire-lang/core` remains available.
