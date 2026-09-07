import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function releaseTarget(ref, selected, realPublish, readManifest) {
  const match = /^refs\/tags\/(core|cli|browser|markdown|wire-lang)@([0-9]+\.[0-9]+\.[0-9]+)$/.exec(
    ref,
  );
  if (realPublish && !match)
    throw new Error("Publishing requires a package tag such as browser@0.5.0");
  const directory = match?.[1] ?? selected;
  if (!["core", "cli", "browser", "markdown", "wire-lang"].includes(directory)) {
    throw new Error("Select one package to release");
  }
  const manifest = readManifest(directory);
  if (match && match[2] !== manifest.version)
    throw new Error("Tag version does not match package.json");
  return { directory, name: manifest.name, version: manifest.version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = releaseTarget(
    process.env.GITHUB_REF ?? "",
    process.env.RELEASE_PACKAGE,
    process.env.GITHUB_EVENT_NAME === "push" || process.env.RELEASE_MODE === "publish",
    (directory) =>
      JSON.parse(
        readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url), "utf8"),
      ),
  );
  console.log(`Release target: ${target.name}@${target.version}`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `directory=${target.directory}\nname=${target.name}\nversion=${target.version}\n`,
  );
}
