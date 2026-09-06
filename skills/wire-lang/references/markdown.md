# Markdown and MDX

Install `@wire-lang/markdown` in a documentation project to render fenced `wire`
blocks as inline SVG during the build. Each block contains a complete source
starting with `schematic`. Ordinary Markdown hosts do not render these fences
unless their processor is configured with the plugin.

For a remark pipeline that produces HTML:

```js
import { remarkWire } from '@wire-lang/markdown';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

const html = await unified()
  .use(remarkParse)
  .use(remarkWire)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(markdown);
```

Install the imported processor packages alongside `@wire-lang/markdown`.
`remarkWire` replaces code nodes with custom diagram nodes. Do not pass those
nodes to `remark-stringify`. If the workflow serializes Markdown first, keep the
fences and use `rehypeWire` after `remarkRehype` in the HTML build instead.

For MDX, pass `rehypeWire` from `@wire-lang/markdown` in the compiler's
`rehypePlugins` array. Use one Wire plugin per pipeline. Both plugins produce
structured SVG nodes and do not require raw HTML to be enabled.

Invalid Wire source fails the build with a diagnostic located in the Markdown
file. Keep the original Markdown in the processor's VFile for accurate columns
inside indented fences, lists, and blockquotes. Only claim a successful build
when the configured processor has actually run.

Generated pages need no Wire browser runtime. Browser DOM discovery is not part
of this integration. For hosts without plugin support, render a `.wire` file
with the CLI and embed the resulting SVG.
