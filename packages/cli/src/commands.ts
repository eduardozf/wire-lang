import { readFile, writeFile } from "node:fs/promises";
import type { Diagnostic } from "@wire-lang/core";
import { compile, hasErrors, layout, serializeSvg } from "@wire-lang/core";
import type { JsonReport } from "./format.js";
import { countDiagnostics, formatHuman, formatJson } from "./format.js";

export interface CliIo {
  out(message: string): void;
  err(message: string): void;
}

export const EXIT_OK = 0;
export const EXIT_FATAL = 1;
export const EXIT_USAGE = 2;

async function readSource(file: string, io: CliIo): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.err(`error: cannot read ${file}: ${message}`);
    return null;
  }
}

/** Emit one diagnostic report, as JSON or human text, for any command. */
function emit(io: CliIo, json: boolean, report: JsonReport): void {
  if (json) {
    io.out(formatJson(report));
  } else {
    io.out(formatHuman(report.file, report.diagnostics));
  }
}

function buildReport(
  command: string,
  file: string,
  diagnostics: readonly Diagnostic[],
  extra: { ok: boolean; out?: string },
): JsonReport {
  return {
    file,
    command,
    ok: extra.ok,
    ...(extra.out !== undefined ? { out: extra.out } : {}),
    diagnostics,
    summary: countDiagnostics(diagnostics),
  };
}

/** `wire check <file>` */
export async function runCheck(file: string, json: boolean, io: CliIo): Promise<number> {
  const source = await readSource(file, io);
  if (source === null) return EXIT_USAGE;
  const { diagnostics } = compile(source);
  emit(io, json, buildReport("check", file, diagnostics, { ok: !hasErrors(diagnostics) }));
  return hasErrors(diagnostics) ? EXIT_FATAL : EXIT_OK;
}

/** `wire render <file> --out <out>` */
export async function runRender(
  file: string,
  out: string,
  json: boolean,
  io: CliIo,
): Promise<number> {
  const source = await readSource(file, io);
  if (source === null) return EXIT_USAGE;

  const result = compile(source);
  if (!result.ok) {
    emit(io, json, buildReport("render", file, result.diagnostics, { ok: false }));
    if (!json) io.err("render aborted: source has fatal diagnostics");
    return EXIT_FATAL;
  }

  const svg = serializeSvg(layout(result.model));
  try {
    await writeFile(out, svg, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.err(`error: cannot write ${out}: ${message}`);
    return EXIT_USAGE;
  }

  emit(io, json, buildReport("render", file, result.diagnostics, { ok: true, out }));
  if (!json) io.out(`rendered ${file} -> ${out}`);
  return EXIT_OK;
}
