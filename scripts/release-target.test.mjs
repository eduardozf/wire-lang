import assert from "node:assert/strict";
import test from "node:test";
import { releaseTarget } from "./release-target.mjs";

const manifest = (directory) => ({
  name: `@wire-lang/${directory}`,
  version: "0.5.0",
});
test("a browser tag selects only browser", () => {
  assert.deepEqual(releaseTarget("refs/tags/browser@0.5.0", "core", true, manifest), {
    directory: "browser",
    name: "@wire-lang/browser",
    version: "0.5.0",
  });
});
test("manual dry runs select one package without a tag", () => {
  assert.equal(releaseTarget("refs/heads/main", "markdown", false, manifest).directory, "markdown");
});
test("rejects global tags, branches, unknown packages and mismatched versions", () => {
  for (const ref of [
    "refs/tags/v0.5.0",
    "refs/heads/main",
    "refs/tags/unknown@0.5.0",
    "refs/tags/browser@0.6.0",
  ]) {
    assert.throws(() => releaseTarget(ref, "browser", true, manifest));
  }
  assert.throws(() => releaseTarget("refs/heads/main", "../core", false, manifest));
});
