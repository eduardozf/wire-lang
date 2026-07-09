import type { Diagnostic, SourceRange } from "@wire-lang/core";
import { renderSvg, WireLangError } from "@wire-lang/core";
import type { Element, Nodes } from "hast";
import { fromHtml } from "hast-util-from-html";
import type { Position } from "unist";
import type { VFile } from "vfile";

interface PositionedFence {
  readonly position?: Position | undefined;
}

function stripGeneratedPositions(node: Nodes): void {
  delete node.position;
  if ("children" in node) {
    for (const child of node.children) {
      stripGeneratedPositions(child);
    }
  }
}

function primaryDiagnostic(error: WireLangError): Diagnostic | undefined {
  return (
    error.diagnostics.find((candidate) => candidate.severity === "error") ?? error.diagnostics[0]
  );
}

function diagnosticPosition(
  fence: PositionedFence,
  range: SourceRange | null | undefined,
): Position | null | undefined {
  const fenceStart = fence.position?.start;

  if (!range || !fenceStart) {
    return fence.position;
  }

  // The fence content starts one line below the opening fence marker and, when
  // the fence sits inside a list or blockquote, shares the marker's
  // indentation, which Markdown strips from the Wire source.
  const columnOffset = fenceStart.column - 1;
  return {
    start: {
      line: fenceStart.line + range.start.line,
      column: columnOffset + range.start.column,
    },
    end: {
      line: fenceStart.line + range.end.line,
      column: columnOffset + range.end.column,
    },
  };
}

function failDocumentBuild(error: WireLangError, fence: PositionedFence, file: VFile): never {
  const diagnostic = primaryDiagnostic(error);

  file.fail(diagnostic?.message ?? error.message, {
    cause: error,
    place: diagnosticPosition(fence, diagnostic?.range),
    ruleId: diagnostic?.code ?? "render",
    source: "wire-lang",
  });
}

export function renderWireElement(source: string, fence: PositionedFence, file: VFile): Element {
  let svg: string;
  try {
    svg = renderSvg(source);
  } catch (error) {
    if (error instanceof WireLangError) {
      failDocumentBuild(error, fence, file);
    }
    throw error;
  }

  const tree = fromHtml(svg, { fragment: true });
  const element = tree.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "svg",
  );
  if (!element) {
    throw new Error("Wire Lang rendered an invalid SVG fragment.");
  }

  stripGeneratedPositions(element);
  element.position = fence.position;
  return element;
}
