# Direct SVG Serializer

Wire Lang's MVP SVG renderer will generate standalone SVG markup directly from the layout model through a small deterministic SVG/XML serializer. We chose this over D3, browser DOM manipulation libraries, JSX, or a virtual DOM layer because the primary outputs are Node-rendered SVG strings for CLI and documentation workflows, and direct serialization is deterministic, snapshot-friendly, and easy to inspect.
