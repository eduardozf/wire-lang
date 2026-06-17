# Standard Component Library

Use these component names, terminals, and properties when generating MVP Wire
Lang source.

| Component | Terminals | Properties | Default Labels |
| --- | --- | --- | --- |
| `Resistor` | `1`, `2` | recommended `value` | `id`, `value` |
| `Capacitor` | `1`, `2` | recommended `capacitance` | `id`, `capacitance` |
| `PolarizedCapacitor` | `+`, `-` | recommended `capacitance` | `id`, `capacitance` |
| `Inductor` | `1`, `2` | recommended `inductance` | `id`, `inductance` |
| `Diode` | `A`, `C` | none | `id` |
| `LED` | `A`, `C` | optional `color` | `id` |
| `NPNTransistor` | `C`, `B`, `E` | none | `id` |
| `PNPTransistor` | `C`, `B`, `E` | none | `id` |
| `Battery` | `+`, `-` | recommended `voltage` | `id`, `voltage` |
| `GroundReference` | `GND` | none | none |
| `SPSTSwitch` | `1`, `2` | optional `state` | `id` |
| `PushButton` | `1`, `2` | optional `normally` | `id` |
| `Header` | from `pins=[...]` | recommended `pins` | `id` |

## Property Examples

```wire
component R1 Resistor value=10k
component C1 Capacitor capacitance=100nF
component BT1 Battery voltage=5V
component D1 LED color=red
component SW1 SPSTSwitch state=open
component BTN1 PushButton normally=open
component J1 Header pins=[VCC,GND,SDA,SCL]
```

## Out Of MVP

MOSFETs, op-amps, relays, motors, displays, sensors, Arduino boards, ESP32
boards, and custom component libraries are outside the MVP standard library. Use
a local `define component ... symbol module` block when a simple module
placeholder is enough.
