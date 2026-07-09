import { compile } from "@mdx-js/mdx";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { rehypeWire, remarkWire } from "../src/index.js";

const MARKDOWN = `# LED

\`\`\`wire
schematic
  title "LED current limiter"
  component R1 Resistor value=220ohm
  component D1 LED color=red
  connect R1.1, D1.A
\`\`\`
`;

describe("remarkWire", () => {
  it("renders wire fences as inline SVG without enabling raw HTML", async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkWire)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(MARKDOWN);

    const html = String(file);
    expect(html).toContain("<h1>LED</h1>");
    expect(html).toContain("<svg");
    expect(html).toContain('data-wire-id="R1"');
    expect(html).not.toContain("language-wire");
    expect(html).not.toContain("<pre>");
  });

  it("leaves other fenced languages unchanged", async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkWire)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process("```js\nconst wire = true;\n```\n");

    expect(String(file)).toBe('<pre><code class="language-js">const wire = true;\n</code></pre>');
  });

  it("fails the document build at the Wire diagnostic's Markdown location", async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkWire)
      .use(remarkRehype)
      .use(rehypeStringify);

    await expect(
      processor.process(`# Broken

\`\`\`wire
schematic
  component X1 Flux
\`\`\`
`),
    ).rejects.toMatchObject({
      line: 5,
      column: 16,
      ruleId: "component.unknown-type",
      source: "wire-lang",
    });
  });

  it("offsets diagnostic columns by the fence indentation", async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkWire)
      .use(remarkRehype)
      .use(rehypeStringify);

    await expect(
      processor.process(`- Broken

  \`\`\`wire
  schematic
    component X1 Flux
  \`\`\`
`),
    ).rejects.toMatchObject({
      line: 5,
      column: 18,
      ruleId: "component.unknown-type",
      source: "wire-lang",
    });
  });
});

describe("rehypeWire", () => {
  it("renders standard pre > code.language-wire HAST blocks", async () => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeWire)
      .use(rehypeStringify)
      .process(MARKDOWN);

    const html = String(file);
    expect(html).toContain("<svg");
    expect(html).toContain('data-wire-id="D1"');
    expect(html).not.toContain("language-wire");
  });

  it("fails the document build at the Wire diagnostic's Markdown location", async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeWire)
      .use(rehypeStringify);

    await expect(
      processor.process(`# Broken

\`\`\`wire
schematic
  component X1 Flux
\`\`\`
`),
    ).rejects.toMatchObject({
      line: 5,
      column: 16,
      ruleId: "component.unknown-type",
      source: "wire-lang",
    });
  });

  it("works as an MDX rehype plugin", async () => {
    const compiled = await compile(MARKDOWN, { rehypePlugins: [rehypeWire] });

    expect(String(compiled)).toMatch(/"data-wire-lang-version": "\d+\.\d+\.\d+"/u);
    expect(String(compiled)).not.toContain("language-wire");
  });
});
