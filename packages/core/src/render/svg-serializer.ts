import type { Point } from "../layout/types.js";

/** Escape text content for XML. */
export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape an attribute value for XML. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Produce a stable, XML-safe id from arbitrary source text. */
export function sanitizeId(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "-");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `w-${cleaned}`;
}

/** Format a number with at most two decimals and no negative zero. */
export function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function line(a: Point, b: Point, cls: string): string {
  return `<line class="${cls}" x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}"/>`;
}

export function circle(center: Point, radius: number, cls: string): string {
  return `<circle class="${cls}" cx="${fmt(center.x)}" cy="${fmt(center.y)}" r="${fmt(radius)}"/>`;
}

export function rect(x: number, y: number, width: number, height: number, cls: string): string {
  return `<rect class="${cls}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" rx="3"/>`;
}

export function polylinePath(points: readonly Point[], cls: string, extra = ""): string {
  const d = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${fmt(point.x)} ${fmt(point.y)}`)
    .join(" ");
  return `<path class="${cls}" fill="none" d="${d}"${extra}/>`;
}

export function polygon(points: readonly Point[], cls: string, extra = ""): string {
  const value = points.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(" ");
  return `<polygon class="${cls}" points="${value}"${extra}/>`;
}

export function text(value: string, point: Point, anchor: string, cls: string): string {
  return `<text class="${cls}" x="${fmt(point.x)}" y="${fmt(point.y)}" text-anchor="${anchor}">${escapeText(value)}</text>`;
}
