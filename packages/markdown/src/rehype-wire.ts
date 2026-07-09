import type { Element, Nodes, Parents, Root } from "hast";
import type { Plugin } from "unified";
import type { VFile } from "vfile";
import { renderWireElement } from "./render-wire.js";

function isElement(node: Nodes, tagName: string): node is Element {
  return node.type === "element" && node.tagName === tagName;
}

function classNames(element: Element): string[] {
  const value: unknown = element.properties.className;
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return typeof value === "string" ? value.split(/\s+/u) : [];
}

function wireCodeBlock(node: Nodes): Element | undefined {
  if (!isElement(node, "pre")) {
    return undefined;
  }

  const significantChildren = node.children.filter(
    (child) => child.type !== "text" || child.value.trim() !== "",
  );
  if (significantChildren.length !== 1 || !isElement(significantChildren[0], "code")) {
    return undefined;
  }

  const code = significantChildren[0];
  return classNames(code).includes("language-wire") ? code : undefined;
}

function textContent(node: Nodes): string {
  if (node.type === "text") {
    return node.value;
  }
  if ("children" in node) {
    return node.children.map(textContent).join("");
  }
  return "";
}

function transformChildren(parent: Parents, file: VFile): void {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    const code = wireCodeBlock(child);
    if (code) {
      const source = textContent(code).replace(/\n$/u, "");
      parent.children[index] = renderWireElement(source, child, file);
    } else if ("children" in child) {
      transformChildren(child, file);
    }
  }
}

/** Replace HAST `pre > code.language-wire` blocks with inline SVG. */
export const rehypeWire: Plugin<[], Root> = function rehypeWire() {
  return (tree, file) => {
    transformChildren(tree, file);
  };
};
