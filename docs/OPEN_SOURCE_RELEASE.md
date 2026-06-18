# Open Source Release Plan

This document tracks the work needed to make Wire Lang understandable,
installable, and safe to share as an open-source project.

## Release Positioning

Short description:

> Wire Lang is a text-first language, TypeScript library, and CLI for rendering
> documentation-friendly electronic schematics as SVG.

Longer explanation:

Wire Lang is closest to Mermaid, but for electronic schematics. Authors write a
small `.wire` source file, Wire Lang validates the circuit model, computes a
stable schematic layout, and emits standalone SVG. The MVP is scoped to
documentation, prototyping, examples, and AI-assisted authoring. It is not a
PCB layout tool, simulator, or full EDA replacement.

Primary audiences:

- developers documenting hardware-adjacent software projects
- educators and technical writers who need source-controlled circuit examples
- AI coding-agent workflows that need parse diagnostics and deterministic output
- maintainers who want SVG schematics without a GUI project file

## Public Release Checklist

- README shows the value quickly: install command, `.wire` source, rendered
  SVG, CLI command, and library API.
- `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` exist at the repository root.
- `CODE_OF_CONDUCT.md`, `SUPPORT.md`, issue templates, and the pull request
  template exist for public collaboration.
- Package-local `LICENSE` files are included in each publishable npm package.
- npm tarballs exclude build metadata such as `dist/.tsbuildinfo`.
- CI runs lint, typecheck, tests, and build.
- Security workflow runs `pnpm audit --prod`.
- Dependabot watches npm and GitHub Actions dependencies.
- The manual release workflow can run npm dry-runs from packed tarballs and can
  publish from a `v*` tag after npm authentication is configured.
- `pnpm release:check` includes a clean-consumer package smoke test: it packs
  the npm tarballs, installs them into a temporary project, imports
  `wire-lang`, runs the `wire` binary, and renders SVG.
- The root package remains private; publishable packages are:
  - `wire-lang`
  - `@wire-lang/core`
  - `@wire-lang/cli`
- Publish order is:
  1. `@wire-lang/core`
  2. `@wire-lang/cli`
  3. `wire-lang`
- Before publishing, verify package names and visibility:

```bash
npm view wire-lang version
npm view @wire-lang/core version
npm view @wire-lang/cli version
```

`npm view` should return `E404` before the first public publish. If any package
name already exists, rename before publishing.

## Release Commands

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

The release check runs linting, public docs/template formatting, typechecking,
tests, build, production dependency audit, package dry-runs, and the
clean-consumer package smoke test.

The GitHub release workflow uses the same checks, packs tarballs, dry-runs `npm
publish`, and can publish in dependency order when manually run in `publish`
mode from a `v*` tag.

Manual publish fallback, only after reviewing the dry-run contents:

```bash
mkdir -p release-tarballs
pnpm --filter @wire-lang/core pack --pack-destination release-tarballs
pnpm --filter @wire-lang/cli pack --pack-destination release-tarballs
pnpm --filter wire-lang pack --pack-destination release-tarballs
npm publish --provenance --access public release-tarballs/wire-lang-core-*.tgz
npm publish --provenance --access public release-tarballs/wire-lang-cli-*.tgz
npm publish --provenance --access public release-tarballs/wire-lang-[0-9]*.tgz
```

For the first release, create a GitHub release tagged `v0.1.0` after npm
publishing succeeds.

## Sharing Plan

Use the rendered LED current-limiter image in `docs/assets/` as the first visual
in launch posts.

Suggested launch message:

> I open-sourced Wire Lang: a text-first way to write small electronic
> schematics and render them to SVG from a TypeScript API or `wire` CLI. The
> MVP focuses on documentation-friendly output, deterministic layout, and
> structured diagnostics for humans and coding agents.

Places to share:

- GitHub release notes with the quick-start example and rendered SVG
- npm package README
- personal blog or project note explaining "Mermaid for electronic schematics"
- electronics/software communities that allow project launches
- AI-agent/devtool communities, emphasizing JSON diagnostics and deterministic
  rendering

Avoid overstating scope. The first release should explicitly say it does not
handle simulation, PCB layout, breadboard layout, or browser auto-render yet.

## Remaining Unknowns

- Package-name availability on npm must be checked immediately before publish.
- The security scan currently relies on `pnpm audit --prod`; broader scanners
  such as gitleaks, trivy, semgrep/opengrep, and actionlint should be run when
  available.
- The GitHub private vulnerability-reporting URL in `SECURITY.md` requires the
  repository to exist at `eduardozf/wire-lang` with GitHub security advisories
  enabled.
- The release workflow authenticates to npm via OIDC trusted publishing (no
  `NPM_TOKEN` secret). Before the first real publish, complete the external
  setup: (1) create a GitHub `release` environment with required reviewers,
  (2) configure each package's trusted publisher on npmjs.com (user
  `eduardozf`, repo `wire-lang`, workflow `release.yml`, environment `release`),
  and (3) bootstrap the initial version of each unpublished package once, since
  a trusted publisher can only be attached to a package that already exists.
- Browser rendering and editor integrations are post-MVP. Keep them out of the
  first-release promise unless they are implemented.
