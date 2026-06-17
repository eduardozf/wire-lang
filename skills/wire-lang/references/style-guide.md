# Authoring Style Guide

Use this style when generating examples unless the user requests otherwise.

## Naming

- Use conventional instance IDs: `R1`, `C1`, `D1`, `Q1`, `BT1`, `SW1`, `J1`.
- Use canonical component names: `Resistor`, `LED`, `Battery`, not lowercase
  guesses.
- Use clear named nets for reused or meaningful nodes: `VCC`, `5V`, `3V3`,
  `GND`, `SDA`, `SCL`, `RESET`.
- Use `connect` for short local joins that do not need a name.

## Source Shape

- Put title and description near the top for documentation examples.
- Declare components before nets for readability, even though reference
  resolution does not require it.
- Group related nets together.
- Put annotations and render hints after electrical declarations.
- Prefer ASCII examples such as `220ohm` unless the user asks for Unicode such
  as `220Ω`.

## Circuit Meaning

- Do not infer missing circuit intent. If the user omits a value or connection,
  either leave it out or ask.
- Missing recommended properties can still render, but good examples should
  include values like resistor resistance and battery voltage.
- Unknown properties should be avoided in examples unless demonstrating
  diagnostics.

## Layout

- Use render hints sparingly.
- Prefer `render direction=left-to-right` for simple signal-flow examples.
- Use groups for obvious input/output organization.
- Do not use absolute coordinates; they are outside the MVP.
