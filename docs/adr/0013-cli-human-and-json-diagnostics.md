# CLI Human and JSON Diagnostics

Wire Lang's MVP developer CLI will emit human-readable diagnostics by default and machine-readable JSON diagnostics when `--json` is passed. We chose this over human-only or JSON-only output because humans need readable terminal feedback, while coding agents and scripts need stable diagnostic codes, source ranges, severity, messages, and suggested fixes without parsing prose.
