import type { ElementContent, Properties } from "hast";
import type { Code, Parents, Root } from "mdast";
import type { Plugin } from "unified";
import type { Literal, Position } from "unist";
import type { VFile } from "vfile";
import { renderWireElement } from "./render-wire.js";

interface WireDiagramData {
  hName: "svg";
  hProperties: Properties;
  hChildren: ElementContent[];
}

interface WireDiagram extends Literal {
  type: "wireDiagram";
  value: string;
  data: WireDiagramData;
  position?: Position | undefined;
}

declare module "mdast" {
  interface RootContentMap {
    wireDiagram: WireDiagram;
  }
}

function isWireFence(node: Parents["children"][number]): node is Code {
  return node.type === "code" && node.lang?.split(/\s+/u)[0] === "wire";
}

function wireDiagram(node: Code, file: VFile): WireDiagram {
  const svg = renderWireElement(node.value, node, file);

  return {
    type: "wireDiagram",
    value: node.value,
    data: {
      hName: "svg",
      hProperties: svg.properties,
      hChildren: svg.children,
    },
    position: node.position,
  };
}

function transformChildren(parent: Parents, file: VFile): void {
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (isWireFence(child)) {
      parent.children[index] = wireDiagram(child, file);
    } else if ("children" in child) {
      transformChildren(child, file);
    }
  }
}

/** Render Markdown code fences tagged `wire` to inline SVG HAST nodes. */
export const remarkWire: Plugin<[], Root> = function remarkWire() {
  return (tree, file) => {
    transformChildren(tree, file);
  };
};
