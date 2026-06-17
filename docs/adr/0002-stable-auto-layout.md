# Stable Auto Layout

Wire Lang's MVP auto-layout must be deterministic and documentation-friendly: the same source, component library version, and renderer version should produce the same SVG, and small source edits should avoid unnecessary global diagram churn where practical. We chose this constraint because Wire Lang is intended for textual documentation and AI-authored diagrams, where unpredictable layout changes make diffs noisy, reviews harder, and generated diagrams less trustworthy.
