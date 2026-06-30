# Standard Component Library

Use these component names, terminals, and properties when generating MVP Wire
Lang source.

| Component | Terminals | Properties | Default Labels |
| --- | --- | --- | --- |
| `Resistor` | `1`, `2` | recommended `value` | `id`, `value` |
| `Capacitor` | `1`, `2` | recommended `capacitance` | `id`, `capacitance` |
| `PolarizedCapacitor` | `+`, `-` | recommended `capacitance` | `id`, `capacitance` |
| `Inductor` | `1`, `2` | recommended `inductance` | `id`, `inductance` |
| `Potentiometer` | `1`, `W`, `2` | recommended `value` | `id`, `value` |
| `Rheostat` | `1`, `2` | recommended `value` | `id`, `value` |
| `Diode` | `A`, `C` | none | `id` |
| `LED` | `A`, `C` | optional `color` | `id` |
| `ZenerDiode` | `A`, `C` | none | `id` |
| `SchottkyDiode` | `A`, `C` | none | `id` |
| `Photodiode` | `A`, `C` | none | `id` |
| `NPNTransistor` | `C`, `B`, `E` | none | `id` |
| `PNPTransistor` | `C`, `B`, `E` | none | `id` |
| `Battery` | `+`, `-` | recommended `voltage` | `id`, `voltage` |
| `GroundReference` | `GND` | none | none |
| `SPSTSwitch` | `1`, `2` | optional `state` | `id` |
| `PushButton` | `1`, `2` | optional `normally` | `id` |
| `Header` | from `pins=[...]` | recommended `pins` | `id` |
| `FerriteBead` | `1`, `2` | none | `id` |
| `TVSDiode` | `A`, `C` | optional `bidirectional` | `id` |
| `Speaker` | `+`, `-` | none | `id` |
| `Antenna` | `1` | none | `id` |
| `TestPoint` | `1` | optional `name` | `id`, `name` |
| `PTC` | `1`, `2` | none | `id` |
| `PowerFlag` | `1` | recommended `name` | none |
| `IC` | from `pins=[...]` | recommended `pins` | `id` |

`PTC` is the resettable-fuse / polyfuse variant. `PowerFlag` draws its `name`
(e.g. `5V`, `3V3`, `VBAT`) as a rail flag and is not a hidden global net.

`Potentiometer` is a three-terminal variable resistor: the two track ends `1`
and `2` are interchangeable and the `W` wiper taps the middle (connect it by name
or via the `wiper` role alias, e.g. `net OUT: RV1.W, ...`). `Rheostat` is the
two-terminal form. `ZenerDiode`, `SchottkyDiode`, and `Photodiode` reuse the
`Diode` `A`/`C` terminals.

## Property Examples

```wire
component R1 Resistor value=10k
component RV1 Potentiometer value=10k
component RH1 Rheostat value=4k7
component D2 ZenerDiode
component D3 SchottkyDiode
component D4 Photodiode
component C1 Capacitor capacitance=100nF
component BT1 Battery voltage=5V
component D1 LED color=red
component SW1 SPSTSwitch state=open
component BTN1 PushButton normally=open
component J1 Header pins=[VCC,GND,SDA,SCL]
component FB1 FerriteBead
component TVS1 TVSDiode bidirectional=true
component LS1 Speaker
component ANT1 Antenna
component TP1 TestPoint name=VOUT
component F1 PTC
component PWR1 PowerFlag name=3V3
component U1 IC pins=[1:VCC@left, 2:GND@left, 3:OUT@right, 4:EN@right]
```

## IC Pins

Use `IC` for chips that need numbered pins. Each pin is `number:name@side`, where
the number and `@side` (`left`, `right`, `top`, `bottom`) are optional and an
omitted side defaults to `left`. Connect pins by name, e.g. `net VCC: U1.VCC, ...`.

## Out Of MVP

MOSFETs, op-amps, relays, motors, displays, sensors, Arduino boards, ESP32
boards, and custom component libraries are outside the MVP standard library. Use
a local `define component ... symbol module` block when a simple module
placeholder is enough.
