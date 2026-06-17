# pnpm, TypeScript Project References, and tsup

Wire Lang's MVP monorepo will use pnpm workspaces, TypeScript project references, and tsup for package builds. We chose this over npm workspaces, Yarn/Berry, or Bun because the project needs straightforward TypeScript library publishing, package-level type checking, and low-friction monorepo scripts without adding unusual runtime or package-manager constraints.
