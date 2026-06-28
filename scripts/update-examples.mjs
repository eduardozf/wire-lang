// Render the documented example gallery from the current Wire Lang renderer.
//
//   pnpm examples:update
//
// The script rebuilds @wire-lang/core first because the renderer is imported
// from packages/core/dist.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 1000;

const EXAMPLES = [
  ["examples/led.wire", "docs/assets/led-current-limiter"],
  ["examples/rc-filter.wire", "docs/assets/rc-filter"],
  ["examples/soil-sensor.wire", "docs/assets/soil-sensor"],
  ["examples/npn-led-driver.wire", "docs/assets/npn-led-driver"],
  ["examples/kitchen-sink.wire", "docs/assets/kitchen-sink"],
  ["examples/bus-rail.wire", "docs/assets/bus-rail"],
];

execFileSync("pnpm", ["--filter", "@wire-lang/core", "run", "build:js"], {
  cwd: ROOT,
  stdio: "inherit",
});

const { compile, layout, serializeSvg } = await import("../packages/core/dist/index.js");

let failed = false;

for (const [inputPath, outputBase] of EXAMPLES) {
  const input = resolve(ROOT, inputPath);
  const source = readFileSync(input, "utf8");
  const result = compile(source);

  if (result.diagnostics.length > 0) {
    failed = true;
    console.error(`${inputPath} has diagnostics:`);
    for (const diagnostic of result.diagnostics) {
      console.error(`  ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
    }
    continue;
  }

  const svg = serializeSvg(layout(result.model));
  const svgPath = resolve(ROOT, `${outputBase}.svg`);
  const pngPath = resolve(ROOT, `${outputBase}.png`);
  writeFileSync(svgPath, svg);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { loadSystemFonts: true },
    background: "white",
  });
  writeFileSync(pngPath, resvg.render().asPng());

  console.log(`wrote ${outputBase}.svg and ${outputBase}.png (${WIDTH}px wide)`);
}

if (failed) process.exit(1);
