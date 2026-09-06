import type { Diagnostic, SourceRange } from "@wire-lang/core";
import { renderSvg, WireLangError } from "@wire-lang/core";
import type { Element, Nodes } from "hast";
import { fromHtml } from "hast-util-from-html";
import type { Point, Position } from "unist";
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
  source: string,
  file: VFile,
): Position | null | undefined {
  const fenceStart = fence.position?.start;

  if (!range || !fenceStart) {
    return fence.position;
  }

  const { line: fenceLine, column: fenceColumn } = fenceStart;
  const sourceLines = source.split(/\r\n|\r|\n/u);
  const documentLines = String(file).split(/\r\n|\r|\n/u);
  function documentPoint(point: SourceRange["start"]): Point {
    const line = fenceLine + point.line;
    const sourceLine = sourceLines[point.line - 1];
    const documentLine = documentLines[line - 1];
    // Markdown removes indentation and container markers independently on each
    // line. Match the retained content to recover that line's removed prefix.
    // Keep the fence-based estimate for trees without matching original text.
    const columnOffset =
      sourceLine !== undefined && documentLine?.endsWith(sourceLine)
        ? documentLine.length - sourceLine.length
        : fenceColumn - 1;
    return { line, column: columnOffset + point.column };
  }

  return {
    start: documentPoint(range.start),
    end: documentPoint(range.end),
  };
}

function failDocumentBuild(
  error: WireLangError,
  fence: PositionedFence,
  source: string,
  file: VFile,
): never {
  const diagnostic = primaryDiagnostic(error);

  file.fail(diagnostic?.message ?? error.message, {
    cause: error,
    place: diagnosticPosition(fence, diagnostic?.range, source, file),
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
      failDocumentBuild(error, fence, source, file);
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
