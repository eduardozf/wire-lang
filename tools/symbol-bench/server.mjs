// Symbol bench dev server (zero dependencies).
//
//   pnpm bench            # build core in watch mode + serve the bench
//   pnpm bench --no-watch # just serve (build core yourself)
//
// Serves only the files the bench UI needs, rebuilds @wire-lang/core when its
// sources change, and exposes `/version` (the dist mtime) so the page can
// live-reload after each rebuild.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const benchRoot = resolve(fileURLToPath(new URL("./", import.meta.url)));
const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const distFile = join(repoRoot, "packages/core/dist/index.js");
const distMapFile = `${distFile}.map`;
const host = process.env.HOST ?? "127.0.0.1";
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

const ROUTES = new Map([
  ["/", { filePath: join(benchRoot, "index.html"), type: MIME[".html"] }],
  ["/bench.js", { filePath: join(benchRoot, "bench.js"), type: MIME[".js"] }],
  ["/packages/core/dist/index.js", { filePath: distFile, type: MIME[".js"] }],
  ["/packages/core/dist/index.js.map", { filePath: distMapFile, type: MIME[".map"] }],
]);

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

  const route = ROUTES.get(url.pathname);
  if (!route) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
    return;
  }

  try {
    const body = await readFile(route.filePath);
    res.writeHead(200, {
      "content-type": route.type,
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
  }
});

server.listen(port, host, () => {
  console.log(`\n  Symbol bench → http://${host}:${port}\n`);
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
