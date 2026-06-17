import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "@wire-lang/cli";
import { describe, expect, it } from "vitest";

function capture(): {
  io: { out(s: string): void; err(s: string): void };
  out: string[];
  err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (s) => out.push(s), err: (s) => err.push(s) }, out, err };
}

function writeWire(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "wire-cli-"));
  const file = join(dir, "circuit.wire");
  writeFileSync(file, contents);
  return file;
}

const VALID = `schematic
  component BT1 Battery voltage=5V
  component R1 Resistor value=1k
  net VCC: BT1.+, R1.1
  net GND: BT1.-, R1.2
`;

describe("cli run", () => {
  it("check returns 0 for valid source (warnings allowed)", async () => {
    const file = writeWire(VALID);
    const cap = capture();
    const code = await run(["check", file], cap.io);
    expect(code).toBe(0);
    expect(cap.out.join("\n")).toContain("0 error(s)");
  });

  it("check returns 1 and JSON diagnostics for fatal source", async () => {
    const file = writeWire("schematic\n  component X1 Flux\n");
    const cap = capture();
    const code = await run(["check", file, "--json"], cap.io);
    expect(code).toBe(1);
    const report = JSON.parse(cap.out.join("\n"));
    expect(report.ok).toBe(false);
    expect(report.command).toBe("check");
    expect(
      report.diagnostics.some((d: { code: string }) => d.code === "component.unknown-type"),
    ).toBe(true);
    expect(report.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it("render writes an SVG file and returns 0", async () => {
    const file = writeWire(VALID);
    const out = file.replace(/\.wire$/, ".svg");
    const cap = capture();
    const code = await run(["render", file, "--out", out], cap.io);
    expect(code).toBe(0);
    expect(readFileSync(out, "utf8").startsWith("<svg")).toBe(true);
  });

  it("render without --out is a usage error (exit 2)", async () => {
    const file = writeWire(VALID);
    const cap = capture();
    const code = await run(["render", file], cap.io);
    expect(code).toBe(2);
    expect(cap.err.join("\n")).toContain("requires --out");
  });

  it("render returns 1 and does not write on fatal source", async () => {
    const file = writeWire("schematic\n  component X1 Flux\n");
    const out = file.replace(/\.wire$/, ".svg");
    const cap = capture();
    const code = await run(["render", file, "--out", out, "--json"], cap.io);
    expect(code).toBe(1);
    const report = JSON.parse(cap.out.join("\n"));
    expect(report.ok).toBe(false);
  });

  it("unknown command returns a usage error (exit 2)", async () => {
    const cap = capture();
    const code = await run(["frobnicate"], cap.io);
    expect(code).toBe(2);
  });

  it("missing file argument returns a usage error (exit 2)", async () => {
    const cap = capture();
    const code = await run(["check"], cap.io);
    expect(code).toBe(2);
  });

  it("--help returns 0", async () => {
    const cap = capture();
    const code = await run(["--help"], cap.io);
    expect(code).toBe(0);
    expect(cap.out.join("\n")).toContain("Wire Lang developer CLI");
  });
});
