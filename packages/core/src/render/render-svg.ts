import { compile } from "../compiler/compile.js";
import { WireLangError } from "../errors.js";
import { layout } from "../layout/engine.js";
import type { LayoutModel, Point, Segment } from "../layout/types.js";
import type { SchematicModel } from "../model/types.js";
import { LANGUAGE_VERSION } from "../model/types.js";
import { circle, escapeAttr, escapeText, fmt, line, sanitizeId, text } from "./svg-serializer.js";
import { renderComponent } from "./symbols.js";

const STYLES = `
.wire-lang { background: #ffffff; }
.wire-wire { stroke: #1f2937; stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.wire-symbol { stroke: #1f2937; stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.wire-symbol-bg { stroke: #1f2937; stroke-width: 1.5; fill: #ffffff; }
.wire-symbol-fill { fill: #1f2937; stroke: none; }
.wire-junction { fill: #1f2937; }
.wire-label { fill: #111827; font: 600 11px var(--wire-font, system-ui, sans-serif); }
.wire-pin-label { fill: #374151; font: 9px var(--wire-font, system-ui, sans-serif); }
.wire-net-label { fill: #2563eb; font: 600 10px var(--wire-font, system-ui, sans-serif); }
.wire-annotation { fill: #6b7280; font: italic 10px var(--wire-font, system-ui, sans-serif); }
`.trim();

const JUNCTION_RADIUS = 2.8;
const HOP_RADIUS = 4;
const EPS = 0.01;

function isHorizontal(segment: Segment): boolean {
  return (
    Math.abs(segment.from.y - segment.to.y) < EPS && Math.abs(segment.from.x - segment.to.x) > EPS
  );
}

function isVertical(segment: Segment): boolean {
  return (
    Math.abs(segment.from.x - segment.to.x) < EPS && Math.abs(segment.from.y - segment.to.y) > EPS
  );
}

function pointKey(point: Point): string {
  return `${Math.round(point.x * 10)},${Math.round(point.y * 10)}`;
}

/**
 * Find, per horizontal segment, the x positions where another wire's vertical
 * segment crosses it at a point that is not a junction. The horizontal segment
 * is the one that "hops" over the vertical one.
 */
function computeHops(model: LayoutModel): Map<Segment, number[]> {
  const horizontals: Segment[] = [];
  const verticals: Segment[] = [];
  for (const wire of model.wires) {
    for (const segment of wire.segments) {
      if (isHorizontal(segment)) horizontals.push(segment);
      else if (isVertical(segment)) verticals.push(segment);
    }
  }

  const junctions = new Set<string>();
  for (const wire of model.wires) {
    for (const junction of wire.junctions) junctions.add(pointKey(junction));
  }

  const hops = new Map<Segment, number[]>();
  for (const h of horizontals) {
    const hy = h.from.y;
    const hMin = Math.min(h.from.x, h.to.x);
    const hMax = Math.max(h.from.x, h.to.x);
    for (const v of verticals) {
      const vx = v.from.x;
      const vMin = Math.min(v.from.y, v.to.y);
      const vMax = Math.max(v.from.y, v.to.y);
      const crossesX = vx > hMin + EPS && vx < hMax - EPS;
      const crossesY = hy > vMin + EPS && hy < vMax - EPS;
      if (!crossesX || !crossesY) continue;
      if (junctions.has(pointKey({ x: vx, y: hy }))) continue;
      const list = hops.get(h) ?? [];
      list.push(vx);
      hops.set(h, list);
    }
  }
  return hops;
}

function hoppedPath(segment: Segment, hopXs: readonly number[]): string {
  const dir = segment.to.x >= segment.from.x ? 1 : -1;
  const sweep = dir > 0 ? 0 : 1; // keep the bump on the same (upper) side
  const y = segment.from.y;
  const ordered = [...hopXs].sort((a, b) => dir * (a - b));
  let d = `M ${fmt(segment.from.x)} ${fmt(y)}`;
  for (const hx of ordered) {
    d += ` L ${fmt(hx - HOP_RADIUS * dir)} ${fmt(y)}`;
    d += ` A ${fmt(HOP_RADIUS)} ${fmt(HOP_RADIUS)} 0 0 ${sweep} ${fmt(hx + HOP_RADIUS * dir)} ${fmt(y)}`;
  }
  d += ` L ${fmt(segment.to.x)} ${fmt(segment.to.y)}`;
  return `<path class="wire-wire" fill="none" d="${d}"/>`;
}

function renderWires(model: LayoutModel): string {
  const hops = model.crossings === "hop" ? computeHops(model) : null;
  const groups: string[] = [];
  for (const wire of model.wires) {
    const segments = wire.segments
      .map((segment) => {
        const hopXs = hops?.get(segment);
        if (hopXs && hopXs.length > 0) return hoppedPath(segment, hopXs);
        return `<line class="wire-wire" x1="${fmt(segment.from.x)}" y1="${fmt(segment.from.y)}" x2="${fmt(segment.to.x)}" y2="${fmt(segment.to.y)}"/>`;
      })
      .join("");
    const netAttr = wire.anonymous ? "" : ` data-wire-net="${escapeAttr(wire.net)}"`;
    groups.push(
      `<g class="wire-net" data-wire-kind="net" data-wire-style="${wire.style}"${netAttr}>${segments}</g>`,
    );
  }
  return groups.join("");
}

function renderNoConnects(model: LayoutModel): string {
  if (model.noConnects.length === 0) return "";
  const size = 4;
  const marks = model.noConnects
    .map((point) => {
      const a = line(
        { x: point.x - size, y: point.y - size },
        { x: point.x + size, y: point.y + size },
        "wire-symbol",
      );
      const b = line(
        { x: point.x - size, y: point.y + size },
        { x: point.x + size, y: point.y - size },
        "wire-symbol",
      );
      return `<g data-wire-kind="no-connect">${a}${b}</g>`;
    })
    .join("");
  return `<g class="wire-no-connects">${marks}</g>`;
}

function renderJunctions(model: LayoutModel): string {
  const dots: string[] = [];
  for (const wire of model.wires) {
    for (const junction of wire.junctions) {
      dots.push(circle(junction, JUNCTION_RADIUS, "wire-junction"));
    }
  }
  return dots.length > 0 ? `<g class="wire-junctions">${dots.join("")}</g>` : "";
}

function renderComponents(model: LayoutModel): string {
  const groups = model.components.map((component) => {
    const inner = renderComponent(component);
    return `<g class="wire-component" data-wire-kind="component" data-wire-id="${escapeAttr(component.id)}" data-wire-type="${escapeAttr(component.typeName)}" data-wire-symbol="${escapeAttr(component.symbol)}" id="${sanitizeId(`wire-component-${component.id}`)}">${inner}</g>`;
  });
  return groups.join("");
}

function renderLabels(model: LayoutModel): string {
  const items = model.labels.map((label) => {
    const cls = label.kind === "annotation" ? "wire-annotation" : "wire-net-label";
    return text(label.text, label.point, label.anchor, cls);
  });
  return items.length > 0 ? `<g class="wire-labels">${items.join("")}</g>` : "";
}

/** Serialize a layout model into a standalone SVG string. */
export function serializeSvg(model: LayoutModel): string {
  const width = Math.max(1, Math.ceil(model.size.width));
  const height = Math.max(1, Math.ceil(model.size.height));
  const titleText = model.title ?? "Wire Lang schematic";
  const descText = model.description ?? `A schematic with ${model.components.length} components.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="wire-lang" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" data-wire-lang-version="${LANGUAGE_VERSION}">`,
    `<title>${escapeText(titleText)}</title>`,
    `<desc>${escapeText(descText)}</desc>`,
    `<style>${STYLES}</style>`,
    `<rect class="wire-background" x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    `<g class="wire-wires">${renderWires(model)}</g>`,
    renderComponents(model),
    renderJunctions(model),
    renderNoConnects(model),
    renderLabels(model),
    `</svg>`,
  ]
    .filter((fragment) => fragment !== "")
    .join("\n");
}

/**
 * Render `.wire` source or a schematic model to a standalone SVG string. Throws
 * {@link WireLangError} with structured diagnostics when rendering cannot
 * complete (for example, fatal source errors).
 */
export function renderSvg(input: string | SchematicModel): string {
  let model: SchematicModel;
  if (typeof input === "string") {
    const result = compile(input);
    if (!result.ok) {
      throw new WireLangError("Cannot render: source has fatal diagnostics.", result.diagnostics);
    }
    model = result.model;
  } else {
    model = input;
    if (model.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new WireLangError(
        "Cannot render: schematic model has fatal diagnostics.",
        model.diagnostics,
      );
    }
  }
  return serializeSvg(layout(model));
}
