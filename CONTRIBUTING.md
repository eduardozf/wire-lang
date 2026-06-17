# Contributing

Thanks for your interest in Wire Lang. This guide covers local setup, the
checks we run, and the project conventions.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) (the repo pins a version via `packageManager`; run
  `corepack enable` to use it automatically)

## Setup

```bash
pnpm install
pnpm build        # tsup builds + tsc project-reference typecheck
```

## Everyday commands

```bash
pnpm test          # run the vitest suite once
pnpm test:watch    # watch mode
pnpm typecheck     # tsc -b across project references
pnpm lint          # Biome (lint + format check + import sort)
pnpm lint:fix      # apply Biome's safe fixes
pnpm format        # format only
```

Try the CLI against an example:

```bash
node packages/wire-lang/dist/bin.js render examples/led.wire --out led.svg
```

## Before opening a pull request

1. `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
2. New or changed behavior is pinned by a test. SVG output is covered by
   snapshot tests; update them deliberately with `pnpm exec vitest run -u` and
   review the diff.
3. Keep the source-of-truth docs in sync **in the same change** (see below).

CI runs lint, typecheck, test, and build on every pull request.

## Keep the docs in sync

When behavior, vocabulary, scope, or architecture changes, update the relevant
document in the same change (see `AGENTS.md`):

- `CONTEXT.md` — domain vocabulary and resolved terminology.
- `docs/MVP.md` — product scope, language semantics, APIs, diagnostics, and
  implementation contracts.
- `docs/adr/` — hard-to-reverse architectural decisions.
- `skills/wire-lang/` — user-facing authoring instructions and syntax guidance.

## Diagnostics are a contract

Diagnostic `code` strings in `packages/core/src/diagnostics.ts` are a public
contract. Add new codes rather than repurposing existing ones, and don't change
a code's string without a deliberate version bump. Human-readable messages may
evolve freely.

## Symbol artwork

Do not copy symbol artwork directly from paid standards, datasheets, EDA tools,
or proprietary symbol libraries.

Built-in symbols must be original SVG drawings based on broadly understood
schematic conventions. References to standards may be used for background and
terminology, but Wire Lang does not claim full compliance with IEC 60617,
IEEE 315, or any other formal standard.
