import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against TypeScript source (no build step required) by aliasing the
// workspace package specifiers to their source entry points.
const coreSrc = fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url));
const cliSrc = fileURLToPath(new URL("./packages/cli/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@wire-lang/core": coreSrc,
      "@wire-lang/cli": cliSrc,
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});
