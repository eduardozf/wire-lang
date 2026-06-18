# Security Review - Wire Lang

**Date:** 2026-06-17
**Scope:** Whole repository current worktree, focused on open-source release readiness
**Reviewer:** Automated + manual review (security-review skill)
**Standards:** OWASP Top 10:2025, CWE Top 25 (2024)

---

## Executive summary

No confirmed Critical, High, Medium, or Low vulnerabilities were found in this
review. Wire Lang's MVP is a local TypeScript library and CLI with no server
runtime, database, authentication surface, or network-facing production code.
The main remaining security gap before a public release is coverage: only
`pnpm audit --prod` was available locally, so broader scanner layers should be
added or run before tagging a release.

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 0     |
| Medium   | 0     |
| Low      | 0     |
| Info     | 0     |

Top priorities (fix before release): none found.

---

## Findings

No confirmed security findings.

---

## Automated scan summary

| Tool                | Layer                           | Ran? | Raw findings    | Confirmed |
| ------------------- | ------------------------------- | ---- | --------------- | --------- |
| gitleaks            | secrets                         | no   | n/a             | 0         |
| trufflehog          | secrets                         | no   | n/a             | 0         |
| semgrep / opengrep  | SAST                            | no   | n/a             | 0         |
| trivy               | deps/IaC/container              | no   | n/a             | 0         |
| osv-scanner         | SCA                             | no   | n/a             | 0         |
| actionlint / zizmor | GitHub Actions                  | no   | n/a             | 0         |
| pnpm audit --prod   | Node production SCA             | yes  | 0               | 0         |
| manual rg checks    | JS sinks, secrets, CI red flags | yes  | 9 reviewed hits | 0         |

Unavailable local tools: `semgrep`, `opengrep`, `gitleaks`, `trufflehog`,
`trivy`, `osv-scanner`, `actionlint`, `zizmor`, and SBOM tools (`syft`,
`cdxgen`). The manual grep pass found:

- `tools/symbol-bench/bench.js` uses `innerHTML`, but only with SVG generated
  by Wire Lang's own renderer inside a local dev-only symbol bench. Rendered
  text nodes use XML escaping in `packages/core/src/render/svg-serializer.ts`.
- Regex hits in parser/compiler/quantity code are simple anchored token parsers,
  not catastrophic backtracking patterns.
- A secret-pattern hit matched the diagnostic code string
  `parse.unexpected-token`, not a credential.
- GitHub Actions `uses:` lines matched the broad CI grep, but actions are pinned
  to full commit SHAs and workflow permissions are read-only.

`pnpm audit --prod` returned: `No known vulnerabilities found`.

---

## Coverage statement

- **Reviewed:** root and package manifests, publish `files` entries,
  `.github/workflows`, release workflow publish steps, issue/PR templates,
  `.github/dependabot.yml`, `SECURITY.md`, `CONTRIBUTING.md`, clean-consumer
  package smoke-test flow, CLI entry and command file I/O, watch command, SVG
  serializer escaping, parser/tokenizer input flow, quantity parsing regexes,
  render path, symbol bench server route handling, and the symbol bench
  `innerHTML` sink.
- **Scanned only (not deep-read):** tests, examples, generated SVG/PNG assets,
  Markdown documentation, and package README files.
- **Not reviewed:** `node_modules`, generated `dist` files beyond package
  dry-run contents, and git history secret scanning because dedicated tools were
  unavailable.
- **Assumptions:** Wire Lang is released as a local library/CLI. Users run it on
  `.wire` files they choose. There is no hosted service, auth boundary,
  database, browser auto-render package, or production HTTP endpoint in the MVP.

This review reflects the state of the code at the scope above. It reduces risk
but does not guarantee the absence of vulnerabilities; treat it as one layer
alongside dependency monitoring, private vulnerability reporting, and re-review
on significant changes.

---

## Recommended follow-ups

- Run `gitleaks detect --source . --redact -v` or `trufflehog git file://.`
  before the first public push/tag to cover git history.
- Add a SAST pass such as `opengrep scan --config=auto .` or
  `semgrep scan --config=auto .` once a scanner is available.
- Add GitHub Actions lint/security checks (`actionlint` and/or `zizmor`) to
  release-readiness CI.
- Generate an SBOM for releases with `syft` or `cdxgen`.
- Configure npm trusted publishing for `.github/workflows/release.yml`, or add
  an `NPM_TOKEN` repository secret, before running the workflow in `publish`
  mode.
