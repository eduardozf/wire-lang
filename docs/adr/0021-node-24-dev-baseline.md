# Node 24 Dev and CI Baseline

Development and CI now target Node.js 24 or newer. We chose this over staying
on Node 20 because the merged test dependencies require it: `jsdom@30`
requires `^22.22.2 || ^24.15.0 || >=26.0.0` and `vitest@5` requires
`^22.12.0 || ^24.0.0 || >=26.0.0`, so `jsdom@30` fails on Node 20 at runtime
(`webidl.util.markAsUncloneable is not a function`). Node 24 was picked over
Node 22 because the publish workflow already runs on Node 24, unifying every
workflow on one version.

Published packages keep their `engines: node >= 20` runtime floor: `jsdom` and
`vitest` are dev-only dependencies used for tests and never ship to consumers,
so raising the consumer floor would be an unnecessary breaking change. Only the
private monorepo root declares `engines: node >= 24.0.0` for contributors. This
partially supersedes [ADR 0017](./0017-esm-only-node-20.md): packages stay
ESM-only, but the dev/CI baseline is Node 24, not Node 20.
