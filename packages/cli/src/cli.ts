import type { CliIo } from "./commands.js";
import { EXIT_OK, EXIT_USAGE, runCheck, runRender } from "./commands.js";
import { runWatch } from "./watch.js";

const VERSION = "0.0.0";

const HELP = `wire - Wire Lang developer CLI

Usage:
  wire check  <file.wire> [--json]
  wire render <file.wire> --out <file.svg> [--json]
  wire watch  <file.wire> --out <file.svg> [--json]

Options:
  --out <path>   Output SVG path (render, watch)
  --json         Emit machine-readable JSON diagnostics
  -h, --help     Show this help
  -v, --version  Show version

Exit codes:
  0  completed (warnings allowed)
  1  fatal source or render diagnostics
  2  usage, file I/O, or configuration problem`;

interface ParsedArgs {
  command?: string;
  file?: string;
  out?: string;
  json: boolean;
  help: boolean;
  version: boolean;
  error?: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { json: false, help: false, version: false };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === "--json") {
      parsed.json = true;
    } else if (token === "-h" || token === "--help") {
      parsed.help = true;
    } else if (token === "-v" || token === "--version") {
      parsed.version = true;
    } else if (token === "--out") {
      const next = argv[i + 1];
      if (next === undefined) {
        parsed.error = "--out requires a path";
        return parsed;
      }
      parsed.out = next;
      i += 1;
    } else if (token.startsWith("--out=")) {
      parsed.out = token.slice("--out=".length);
    } else if (token.startsWith("-")) {
      parsed.error = `unknown option "${token}"`;
      return parsed;
    } else {
      positionals.push(token);
    }
  }

  parsed.command = positionals[0];
  parsed.file = positionals[1];
  if (positionals.length > 2) {
    parsed.error = `unexpected argument "${positionals[2]}"`;
  }
  return parsed;
}

const defaultIo: CliIo = {
  out: (message) => process.stdout.write(`${message}\n`),
  err: (message) => process.stderr.write(`${message}\n`),
};

/** Parse argv (without `node`/script) and run the requested command. */
export async function run(argv: readonly string[], io: CliIo = defaultIo): Promise<number> {
  const args = parseArgs(argv);

  if (args.error) {
    io.err(`error: ${args.error}`);
    io.err(HELP);
    return EXIT_USAGE;
  }
  if (args.help) {
    io.out(HELP);
    return EXIT_OK;
  }
  if (args.version) {
    io.out(VERSION);
    return EXIT_OK;
  }
  if (!args.command) {
    io.err(HELP);
    return EXIT_USAGE;
  }
  if (args.command !== "check" && args.command !== "render" && args.command !== "watch") {
    io.err(`error: unknown command "${args.command}"`);
    io.err(HELP);
    return EXIT_USAGE;
  }
  if (!args.file) {
    io.err(`error: ${args.command} requires a <file.wire> argument`);
    return EXIT_USAGE;
  }

  switch (args.command) {
    case "check":
      return runCheck(args.file, args.json, io);
    case "render":
      if (!args.out) {
        io.err("error: render requires --out <file.svg>");
        return EXIT_USAGE;
      }
      return runRender(args.file, args.out, args.json, io);
    case "watch":
      if (!args.out) {
        io.err("error: watch requires --out <file.svg>");
        return EXIT_USAGE;
      }
      return runWatch(args.file, args.out, args.json, io);
    default:
      return EXIT_USAGE;
  }
}
