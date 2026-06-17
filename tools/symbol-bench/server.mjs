// Symbol bench dev server (zero dependencies).
//
//   pnpm bench            # build core in watch mode + serve the bench
//   pnpm bench --no-watch # just serve (build core yourself)
//
// Serves the repo root so the page can `import "/packages/core/dist/index.js"`,
// rebuilds @wire-lang/core when its sources change, and exposes `/version`
// (the dist mtime) so the page can live-reload after each rebuild.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const distFile = join(repoRoot, "packages/core/dist/index.js");
const port = Number(process.env.PORT ?? 4321);
const watch = !process.argv.includes("--no-watch");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

async function distVersion() {
  try {
    return String((await stat(distFile)).mtimeMs);
  } catch {
    return "missing";
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === "/version") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end(await distVersion());
    return;
  }

  // Map "/" to the bench page; everything else is served from the repo root.
  const rel = url.pathname === "/" ? "tools/symbol-bench/index.html" : url.pathname.slice(1);
  const filePath = normalize(join(repoRoot, rel));
  if (!filePath.startsWith(repoRoot)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end(`not found: ${rel}`);
  }
});

server.listen(port, () => {
  console.log(`\n  Symbol bench → http://localhost:${port}\n`);
  if (watch) {
    console.log("  Watching @wire-lang/core (edit packages/core/src/render/symbols.ts)\n");
    const child = spawn(
      "pnpm",
      ["--filter", "@wire-lang/core", "run", "build:js", "--watch"],
      { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
    );
    const stop = () => {
      child.kill();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } else {
    console.log("  --no-watch: build core yourself (pnpm --filter @wire-lang/core run build:js)\n");
  }
});
