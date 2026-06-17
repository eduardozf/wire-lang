# @wire-lang/cli

Developer CLI for [Wire Lang](https://github.com/eduardozf/wire-lang). Provides
the `check`, `render`, and `watch` commands over `.wire` source files.

Most users should install the [`wire-lang`](https://www.npmjs.com/package/wire-lang)
aggregate package, which ships this CLI as the `wire` binary. Install this
package directly only if you want to invoke the runner programmatically.

```bash
npm install @wire-lang/cli
```

## Commands

```bash
wire check  <file.wire> [--json]              # diagnostics only, no output file
wire render <file.wire> --out <file.svg> [--json]
wire watch  <file.wire> --out <file.svg> [--json]
```

Exit codes: `0` completed (warnings allowed), `1` fatal source/render
diagnostics, `2` usage or I/O problem. `--json` emits a machine-readable report
(`{ file, command, ok, diagnostics, summary }`).

## Programmatic use

```ts
import { run } from "@wire-lang/cli";

// Inject your own IO sinks (defaults write to stdout/stderr).
const exitCode = await run(["check", "circuit.wire"], {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
```

## License

MIT
