# Monorepo Package Structure

Wire Lang's MVP will use a monorepo with separate packages for the core library and developer CLI, with browser auto-render, language-server, and editor integrations added as post-MVP packages. We chose this over a single internal package because the MVP already has distinct runtime surfaces, and future browser/editor packages should reuse the same grammar, validation, and rendering code without turning each internal package into a mixed runtime bundle.
