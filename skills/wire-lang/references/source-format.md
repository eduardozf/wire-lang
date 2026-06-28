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
component U1 IC pins=[1:VCC@left, 2:GND@left, 3:OUT@right]
```

Use `component ID Type` for every component instance. For `IC`, pins are
`number:name@side`; the number and `@side` are optional (side defaults to `left`).

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

### No-Connect

```wire
no-connect U1.7
```

Mark a terminal as intentionally unconnected. It renders as an `X`. A terminal
cannot be both in a net and `no-connect`.

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
render crossings=hop
render layout=bus-rail
render R1 orientation=vertical
render Inputs side=left
render U1 anchor=center
render net VCC style=label
```

Render hints guide layout but do not change the circuit.

`direction`, `crossings`, `layout`, and net `style` are honored today. By default
(`crossings=gap`) wires that cross without a junction are left simply
overlapping; `crossings=hop` opts in to a small hop at each such crossing.
`layout=bus-rail` redraws the schematic as a block diagram between a top supply
rail and a bottom ground rail, color-coding nets by family and bundling grouped
signals into bus trunks (power and buses are inferred from net names and
connectivity — no extra syntax needed). `orientation`, `side`, and `anchor` (and `group`
layout) are accepted and validated but not yet positioned by the bundled renderer
— using them emits a `render.not-yet-honored` (or `group.not-yet-honored`)
warning. They are safe to write for forward compatibility; they just have no
visual effect yet.
