# `@wire-lang/markdown`

Remark, rehype, and MDX support for fenced `wire` diagrams. Browser rendering
after HTML loads is the default; ahead-of-time SVG rendering is opt-in.

## Default: render in the browser

Write a complete Wire source inside a fence:

````markdown
```wire
schematic
  component R1 Resistor value=220ohm
  component D1 LED color=red
  connect R1.1, D1.A
```
````

Install `@wire-lang/browser` and initialize it in your site's client entry point:

```js
import wire from "@wire-lang/browser";

const { errors } = await wire.initialize();
for (const { error } of errors) console.error(error);
```

The browser discovers standard `pre > code.language-wire` blocks, renders their
source asynchronously, hides the original blocks, and inserts SVG diagrams.
Without the runtime, readers see the source code. This does not enable native
`wire` support on hosts where you cannot configure scripts or the Markdown build.

No Wire Markdown plugin is needed if the processor already emits those blocks.
`remarkWire` and `rehypeWire` default to `{ mode: "browser" }`, which preserves
the code nodes for this workflow. Preserve the `language-wire` class and source
text through syntax highlighting. For MDX, run the browser renderer after
hydration. See the [browser guide](../browser) for lifecycle and error handling.

## Ahead-of-time rendering

```bash
npm install @wire-lang/markdown unified remark-parse remark-rehype rehype-stringify
```

The package is ESM-only and requires Node.js 20 or newer. Pass `{ mode: "static" }`
to render during the build, producing inline SVG with no Wire browser runtime:

```js
import { remarkWire } from "@wire-lang/markdown";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const html = await unified()
  .use(remarkParse)
  .use(remarkWire, { mode: "static" })
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(markdown);
```

Alternatively, use `.use(rehypeWire, { mode: "static" })` after `remarkRehype`.
Use one Wire plugin per pipeline. Both produce structured HTML nodes without
requiring raw HTML support. Default exports are available at
`@wire-lang/markdown/remark` and `@wire-lang/markdown/rehype`.

For MDX, install `@mdx-js/mdx` and pass the same option:

```js
import { compile } from "@mdx-js/mdx";
import { rehypeWire } from "@wire-lang/markdown";

const result = await compile(mdx, {
  rehypePlugins: [[rehypeWire, { mode: "static" }]],
});
```

Static `remarkWire` replaces code nodes with custom diagram nodes that
`remark-stringify` cannot serialize. If you serialize Markdown first, leave the
fences intact and use static `rehypeWire` in the later HTML build.

If the pipeline sanitizes user-authored HTML, place the sanitizer before static
`rehypeWire`. A sanitizer after static `remarkWire` needs an SVG-aware schema.

## Errors

Other fenced languages are unchanged. In browser mode, invalid source reaches
the browser, whose runtime returns errors while continuing with other blocks.

In static mode, fatal Wire diagnostics fail the document build as VFile
messages. Line and column point into the original Markdown or MDX file, and
`cause` retains the original `WireLangError`. Preserve the original VFile text
for accurate columns in unevenly indented fences and nested containers.
Static processing may also run at request time on a server.
