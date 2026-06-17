# CLI Exit Codes

Wire Lang's MVP developer CLI will return `0` when the command completes without fatal diagnostics, `1` when source diagnostics or render failures prevent completion, and `2` for CLI usage, file I/O, or configuration problems. We chose this over failing on warnings or defining many detailed exit codes because coding agents and CI need a simple stable contract, while warnings should remain visible without blocking useful renders by default.
