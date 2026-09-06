# Markdown and MDX

Write a complete source starting with `schematic` inside a fenced `wire` block.
A fence identifies the language; the hosting site must configure rendering.

## Default browser rendering

Install `@wire-lang/browser` and add this to the site's client entry point:

```js
import wire from '@wire-lang/browser';

const { errors } = await wire.initialize();
for (const { error } of errors) console.error(error);
```

The runtime waits for HTML readiness, finds `pre > code.language-wire` blocks,
and renders them asynchronously. It preserves source, hides successful blocks,
and inserts SVG containers. Standard Markdown output needs no Wire Markdown
plugin. Merely installing a package does not activate rendering.

Call `wire.run()` after client navigation or source changes. For MDX rendered
by React, run after hydration in a client effect. Invalid blocks remain as source;
inspect the returned errors to log or display diagnostics. Errors refer to lines
inside the block. This workflow downloads the compiler and renderer to the browser.

## Ahead-of-time rendering

When the user wants static HTML without Wire JavaScript, install
`@wire-lang/markdown` and select `{ mode: 'static' }` explicitly:

```js
import { remarkWire } from '@wire-lang/markdown';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

const html = await unified()
  .use(remarkParse)
  .use(remarkWire, { mode: 'static' })
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(markdown);
```

Install the imported processor packages too. Alternatively, use static
`rehypeWire` after `remarkRehype`. For MDX, configure
`rehypePlugins: [[rehypeWire, { mode: 'static' }]]`. Use one Wire plugin per
pipeline. Without the static option, both plugins preserve code for the browser.

Static `remarkWire` creates diagram nodes that `remark-stringify` cannot serialize.
If the workflow serializes Markdown first, retain the fences and render later
with static `rehypeWire`. Both static plugins produce structured SVG nodes without
requiring raw HTML support.

Invalid source fails the static build with diagnostics in the original Markdown
file. Preserve that text in the VFile for accurate columns inside containers and
unevenly indented fences. Only claim validation when the processor actually ran.

For hosts where users cannot configure client scripts or build plugins, render a
`.wire` file with the CLI and embed its SVG. Do not promise native `wire` fence
support in an arbitrary Markdown viewer.
