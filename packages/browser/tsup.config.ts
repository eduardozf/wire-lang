import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  // A standalone ESM file also works in a script tag without an import map.
  noExternal: ["@wire-lang/core"],
  outDir: "dist",
  dts: false,
  sourcemap: true,
  clean: false,
});
