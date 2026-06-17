// Dev utility: render a .wire file to SVG (via @wire-lang/core) and rasterize
// it to PNG with @resvg/resvg-js for visual inspection.
//
//   node scripts/wire-to-png.mjs <input.wire> [output.png] [width]
//
// Requires `pnpm --filter @wire-lang/core run build:js` first.

import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { renderSvg } from "../packages/core/dist/index.js";

const [input, outArg, widthArg] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/wire-to-png.mjs <input.wire> [output.png] [width]");
  process.exit(2);
}

const out = outArg ?? input.replace(/\.wire$/, ".png");
const svgPath = out.replace(/\.png$/, ".svg");
const width = Number(widthArg ?? 1000);

const source = readFileSync(input, "utf8");
const svg = renderSvg(source);
writeFileSync(svgPath, svg);

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: width },
  font: { loadSystemFonts: true },
  background: "white",
});
const png = resvg.render().asPng();
writeFileSync(out, png);

console.log(`wrote ${svgPath} and ${out} (${width}px wide)`);
