# Public wire-lang Package

Wire Lang's MVP will publish `wire-lang` as the user-facing aggregate package, while implementation packages remain scoped workspaces such as `@wire-lang/core` and `@wire-lang/cli`. We chose this over exposing only scoped packages because the primary user workflow should stay simple: install one package, import the common APIs, and run the `wire` binary. Browser auto-render can later join the aggregate package once `@wire-lang/browser` exists.
