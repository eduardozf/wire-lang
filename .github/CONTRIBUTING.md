# Contributing

Thanks for your interest in Wire Lang. This guide covers local setup, the
checks we run, and the project conventions.

## Prerequisites

- Node.js 20.19+
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

Use the GitHub issue and pull request templates when contributing publicly.
Questions belong in discussions when enabled, or in an issue marked as a
question. Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Keep the docs in sync

When behavior, vocabulary, scope, or architecture changes, update the relevant
document in the same change (see `AGENTS.md`):

- `docs/CONTEXT.md` — domain vocabulary and resolved terminology.
- `docs/MVP.md` — product scope, language semantics, APIs, diagnostics, and
  implementation contracts.
- `docs/adr/` — hard-to-reverse architectural decisions.
- `skills/wire-lang/` — user-facing authoring instructions and syntax guidance.

## Package releases

Packages have independent versions. Bump only packages whose published contents
or dependency requirements changed, and record the affected package names and
versions in `CHANGELOG.md`. Do not bump every package for a browser-only change.

After merging the version change and passing `pnpm release:check`, tag the commit
with the package directory and version, for example `browser@0.5.0`, and push that
tag. Supported prefixes are `core`, `cli`, `browser`, `markdown`, and `wire-lang`.
The release workflow validates the tag against that package's manifest and
publishes only that package. Global `v*` tags no longer trigger publishing.
Manual branch runs are dry runs with an explicit package choice; real publishes
require a matching package tag.

Workspace dependencies resolve to each dependency's own version during packing.
Publish required dependency versions first. A core change does not automatically
release every consumer: assess which consumers need the new core version.
Browser bundles core, so delivering a core fix to browser users requires a browser
release too. The aggregate CLI reports the installed CLI package's version.
The SVG language metadata is independent of browser, CLI, and Markdown versions.

Trusted publishers continue to use `publish.yml` and the `release` environment
for each npm package. Each tag releases one package; retry only unpublished
versions, since npm does not allow overwriting an existing version.

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
