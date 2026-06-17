# Source Format

Use this reference when writing or revising `.wire` source.

## Skeleton

```wire
schematic
  title "Readable schematic title"
  description "One sentence describing the circuit."

  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red

  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-

  annotation "Current limiting resistor" near R1
  render direction=left-to-right
```

## Statements

### Components

```wire
component R1 Resistor value=220ohm
component D1 LED color=red
component J1 Header pins=[VCC,GND,SDA,SCL]
```

Use `component ID Type` for every component instance.

### Named Nets

```wire
net VCC: BT1.+, R1.1
net GND: D1.C, BT1.-
```

Repeated named nets with the same name merge into one logical net.

### Anonymous Connections

```wire
connect R1.2, D1.A
```

Use `connect` when the electrical node does not need a reusable name.

### Local Components

```wire
define component SoilSensor
  terminal VCC
  terminal GND
  terminal AOUT
  terminal DOUT
  symbol module
end

component S1 SoilSensor
```

Use local components for modules or parts that are not in the standard library.

### Annotations And Comments

```wire
// Source-only comment
annotation "Status LED" near D1
annotation "Power rail" near net VCC
```

Use annotations for visible diagram text. Use comments only for source notes.

### Render Hints

```wire
render direction=left-to-right
render R1 orientation=vertical
render Inputs side=left
render U1 anchor=center
render net VCC style=label
```

Render hints guide layout but do not change the circuit.

`direction` and net `style` are honored today. `orientation`, `side`, and
`anchor` (and `group` layout) are accepted and validated but not yet positioned
by the bundled renderer — using them emits a `render.not-yet-honored` (or
`group.not-yet-honored`) warning. They are safe to write for forward
compatibility; they just have no visual effect yet.
