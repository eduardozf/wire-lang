// Rewrites `workspace:` protocol dependency ranges in each publishable package
// to the real version of the local package they point at.
//
// The release runs `npm publish` from each package directory so that npm's OIDC
// trusted-publishing token exchange engages (it does not for `npm publish
// <tarball>`). But npm, unlike pnpm, does not understand the `workspace:`
// protocol, so it would publish `workspace:*` verbatim. This script applies the
// same rewrite pnpm would do at pack time, in place, before publishing.
//
// Mapping (matching pnpm's defaults):
//   workspace:*      -> <version>
//   workspace:~      -> ~<version>
//   workspace:^      -> ^<version>
//   workspace:<range>-> <range>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirs = ["packages/core", "packages/cli", "packages/markdown", "packages/wire-lang"];
const depFields = ["dependencies", "optionalDependencies", "peerDependencies"];

const manifests = packageDirs.map((dir) => {
  const path = join(root, dir, "package.json");
  return { dir, path, json: JSON.parse(readFileSync(path, "utf8")) };
});

const versionByName = new Map(manifests.map((m) => [m.json.name, m.json.version]));

function resolveRange(name, range) {
  const target = range.slice("workspace:".length);
  const version = versionByName.get(name);
  if (!version) {
    throw new Error(`workspace dependency ${name} is not a local package`);
  }
  if (target === "" || target === "*") return version;
  if (target === "~" || target === "^") return `${target}${version}`;
  return target; // explicit range, e.g. workspace:>=1.0.0
}

let total = 0;
for (const { path, json } of manifests) {
  let changed = false;
  for (const field of depFields) {
    const deps = json[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        deps[name] = resolveRange(name, range);
        changed = true;
        total += 1;
        console.log(`${json.name}: ${field}.${name} ${range} -> ${deps[name]}`);
      }
    }
  }
  // Only rewrite manifests we actually changed, so packages without workspace
  // dependencies (e.g. core) keep their original formatting.
  if (changed) writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

console.log(`Pinned ${total} workspace dependency range(s).`);
