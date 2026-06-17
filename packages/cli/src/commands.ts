import { readFile, writeFile } from "node:fs/promises";
import { compile, hasErrors, layout, serializeSvg } from "@wire-lang/core";
import type { Diagnostic } from "@wire-lang/core";
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

function reportCheck(
  file: string,
  diagnostics: readonly Diagnostic[],
  json: boolean,
  io: CliIo,
): void {
  if (json) {
    io.out(
      formatJson({
        file,
        command: "check",
        ok: !hasErrors(diagnostics),
        diagnostics,
        summary: countDiagnostics(diagnostics),
      }),
    );
  } else {
    io.out(formatHuman(file, diagnostics));
  }
}

/** `wire check <file>` */
export async function runCheck(file: string, json: boolean, io: CliIo): Promise<number> {
  const source = await readSource(file, io);
  if (source === null) return EXIT_USAGE;
  const { diagnostics } = compile(source);
  reportCheck(file, diagnostics, json, io);
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
    if (json) {
      io.out(
        formatJson({
          file,
          command: "render",
          ok: false,
          diagnostics: result.diagnostics,
          summary: countDiagnostics(result.diagnostics),
        }),
      );
    } else {
      io.out(formatHuman(file, result.diagnostics));
      io.err("render aborted: source has fatal diagnostics");
    }
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

  if (json) {
    io.out(
      formatJson({
        file,
        command: "render",
        ok: true,
        out,
        diagnostics: result.diagnostics,
        summary: countDiagnostics(result.diagnostics),
      }),
    );
  } else {
    io.out(formatHuman(file, result.diagnostics));
    io.out(`rendered ${file} -> ${out}`);
  }
  return EXIT_OK;
}
