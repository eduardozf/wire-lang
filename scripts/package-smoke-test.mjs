import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const tscBin = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
const runner = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const binName = process.platform === "win32" ? "wire.cmd" : "wire";

async function run(command, args, options = {}) {
  const { stdout, stderr } = await execFile(command, args, {
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  return { stdout, stderr };
}

async function packAll(packDir) {
  await run(runner, ["--filter", "@wire-lang/core", "pack", "--pack-destination", packDir], {
    cwd: repoRoot,
  });
  await run(runner, ["--filter", "@wire-lang/cli", "pack", "--pack-destination", packDir], {
    cwd: repoRoot,
  });
  await run(runner, ["--filter", "@wire-lang/markdown", "pack", "--pack-destination", packDir], {
    cwd: repoRoot,
  });
  await run(runner, ["--filter", "wire-lang", "pack", "--pack-destination", packDir], {
    cwd: repoRoot,
  });
}

function tarball(packDir, fileName) {
  return join(packDir, fileName);
}

async function main() {
  const packageJson = JSON.parse(
    await readFile(new URL("../packages/wire-lang/package.json", import.meta.url), "utf8"),
  );
  const version = packageJson.version;
  const workspace = await mkdtemp(join(tmpdir(), "wire-lang-package-smoke-"));
  const packDir = join(workspace, "tarballs");
  const consumerDir = join(workspace, "consumer");

  try {
    await mkdir(packDir, { recursive: true });
    await mkdir(consumerDir, { recursive: true });
    await packAll(packDir);
    await writeFile(
      join(consumerDir, "package.json"),
      JSON.stringify({ private: true, type: "module" }, null, 2),
    );

    await run(
      npm,
      [
        "install",
        "--no-audit",
        "--no-fund",
        tarball(packDir, `wire-lang-core-${version}.tgz`),
        tarball(packDir, `wire-lang-cli-${version}.tgz`),
        tarball(packDir, `wire-lang-markdown-${version}.tgz`),
        tarball(packDir, `wire-lang-${version}.tgz`),
      ],
      { cwd: consumerDir },
    );

    const source = `schematic
  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red
  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-
`;
    await writeFile(join(consumerDir, "led.wire"), source);
    await writeFile(
      join(consumerDir, "api-smoke.mjs"),
      `import { compile, renderSvg } from "wire-lang";

const source = ${JSON.stringify(source)};
const compiled = compile(source);
if (!compiled.ok) {
  throw new Error("compile returned fatal diagnostics");
}
const svg = renderSvg(source);
if (!svg.startsWith("<svg") || !svg.includes(${JSON.stringify(`data-wire-lang-version="${version}"`)})) {
  throw new Error("renderSvg did not return the expected standalone SVG");
}
`,
    );

    await run("node", ["api-smoke.mjs"], { cwd: consumerDir });
    await writeFile(
      join(consumerDir, "markdown-smoke.mjs"),
      `import { rehypeWire, remarkWire } from "@wire-lang/markdown";
import { unified } from "unified";

const source = ${JSON.stringify(source)};
const remarkTree = {
  type: "root",
  children: [{ type: "code", lang: "wire", value: source }],
};
await unified().use(remarkWire).run(remarkTree);
if (remarkTree.children[0].type !== "wireDiagram" || remarkTree.children[0].data?.hName !== "svg") {
  throw new Error("remarkWire did not replace the wire fence with inline SVG data");
}

const rehypeTree = {
  type: "root",
  children: [{
    type: "element",
    tagName: "pre",
    properties: {},
    children: [{
      type: "element",
      tagName: "code",
      properties: { className: ["language-wire"] },
      children: [{ type: "text", value: source + "\\n" }],
    }],
  }],
};
await unified().use(rehypeWire).run(rehypeTree);
if (rehypeTree.children[0].tagName !== "svg") {
  throw new Error("rehypeWire did not replace the wire code block with inline SVG");
}
`,
    );
    await run("node", ["markdown-smoke.mjs"], { cwd: consumerDir });
    await writeFile(
      join(consumerDir, "types-smoke.ts"),
      `import { rehypeWire, remarkWire } from "@wire-lang/markdown";
import { DiagnosticCodes, renderSvg, type CompileResult } from "wire-lang";

const svg: string = renderSvg("schematic\\n  component R1 Resistor value=1k\\n  net N: R1.1, R1.2\\n");
const code: string = DiagnosticCodes.componentUnknownType;
const result: CompileResult | null = null;
void rehypeWire;
void remarkWire;
void svg;
void code;
void result;
`,
    );
    await run(
      "node",
      [
        tscBin,
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2022",
        "--strict",
        "--skipLibCheck",
        "--noEmit",
        "types-smoke.ts",
      ],
      { cwd: consumerDir },
    );

    const wireBin = join(consumerDir, "node_modules", ".bin", binName);
    const versionResult = await run(wireBin, ["--version"], { cwd: consumerDir });
    if (versionResult.stdout.trim() !== version) {
      throw new Error(`wire --version returned ${JSON.stringify(versionResult.stdout.trim())}`);
    }

    const render = await run(wireBin, ["render", "led.wire", "--out", "led.svg", "--json"], {
      cwd: consumerDir,
    });
    const report = JSON.parse(render.stdout);
    if (!report.ok || report.out !== "led.svg") {
      throw new Error(`wire render returned an unexpected JSON report: ${render.stdout}`);
    }

    const svg = await readFile(join(consumerDir, "led.svg"), "utf8");
    if (!svg.startsWith("<svg") || !svg.includes('data-wire-id="R1"')) {
      throw new Error("wire render did not produce the expected SVG file");
    }

    console.log("package smoke test passed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
