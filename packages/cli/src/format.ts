import type { Diagnostic } from "@wire-lang/core";

export interface DiagnosticCounts {
  readonly errors: number;
  readonly warnings: number;
}

export function countDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticCounts {
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

function locationLabel(diagnostic: Diagnostic): string {
  if (!diagnostic.range) return "-";
  return `${diagnostic.range.start.line}:${diagnostic.range.start.column}`;
}

/** Human-readable diagnostic report, the default CLI output. */
export function formatHuman(file: string, diagnostics: readonly Diagnostic[]): string {
  const lines: string[] = [file];
  if (diagnostics.length === 0) {
    lines.push("  no diagnostics");
  }
  for (const diagnostic of diagnostics) {
    lines.push(
      `  ${diagnostic.severity.padEnd(7)} ${locationLabel(diagnostic).padEnd(7)} ${diagnostic.code}  ${diagnostic.message}`,
    );
    for (const fix of diagnostic.fixes ?? []) {
      lines.push(`            fix: ${fix.description} -> "${fix.replacement}"`);
    }
  }
  const counts = countDiagnostics(diagnostics);
  lines.push(`  ${counts.errors} error(s), ${counts.warnings} warning(s)`);
  return lines.join("\n");
}

export interface JsonReport {
  readonly file: string;
  readonly command: string;
  readonly ok: boolean;
  readonly out?: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly summary: DiagnosticCounts;
}

/** Machine-readable diagnostic report for `--json`. */
export function formatJson(report: JsonReport): string {
  return JSON.stringify(report, null, 2);
}
