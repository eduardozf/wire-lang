// The user-facing aggregate package. Re-exports the common Wire Lang API and
// the programmatic CLI entry point.

export * from "@wire-lang/core";
export { run } from "@wire-lang/cli";
export type { CliIo } from "@wire-lang/cli";
