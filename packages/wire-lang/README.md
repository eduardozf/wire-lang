# wire-lang

Text-first electronic schematics rendered to SVG. This is the user-facing
aggregate package: it re-exports the [`@wire-lang/core`](https://www.npmjs.com/package/@wire-lang/core)
API and ships the `wire` CLI.

```bash
npm install wire-lang
```

```wire
schematic
  title "LED current limiting circuit"
  description "A 5V battery drives a red LED through a 220 ohm resistor."

  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red

  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-

  annotation "Current limiting resistor" near R1
  render direction=left-to-right
```

## CLI

```bash
wire check  led.wire
wire render led.wire --out led.svg
wire watch  led.wire --out led.svg
```

## Library

```ts
import { renderSvg } from "wire-lang";

const svg = renderSvg(source); // throws WireLangError on fatal source
```

The full programmatic API (`parse`, `compile`, `layout`, `serializeSvg`, types,
diagnostics) is re-exported from `@wire-lang/core`. See the
[project README](https://github.com/eduardozf/wire-lang#readme) for language
documentation and scope.

## License

MIT
