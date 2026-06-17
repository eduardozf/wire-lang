# Public and Partial AST for Authoring Feedback

Wire Lang's MVP will expose a parse API that returns a public AST for valid source and a partial AST with diagnostics for invalid source. This increases parser complexity, but it is necessary because AI-assisted authoring and editor feedback are first-class use cases; users need structured feedback while writing, not only a final render failure.
