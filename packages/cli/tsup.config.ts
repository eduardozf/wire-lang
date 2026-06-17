import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  dts: false,
  sourcemap: true,
  // tsc -b emits the .d.ts files into dist; do not wipe them here.
  clean: false,
});
