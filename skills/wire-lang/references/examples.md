# Good And Bad Examples

Use these examples to teach Wire Lang authoring patterns.

## Good: LED Current Limiting Circuit

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

Why this is good:

- Component instances are explicit.
- Power and ground are connected through named nets.
- The resistor-to-LED connection uses `connect` because it does not need a name.
- The visible note uses `annotation`.

## Bad: Implicit Ground

```wire
schematic
  component BT1 Battery voltage=5V
  component D1 LED color=red

  net VCC: BT1.+, D1.A
  net GND: BT1.-
```

Problem: `GND` is not a magic global. `D1.C` is not connected to ground.

Better:

```wire
schematic
  component BT1 Battery voltage=5V
  component D1 LED color=red

  net VCC: BT1.+, D1.A
  net GND: D1.C, BT1.-
```

## Bad: Visual Wire Thinking

```wire
schematic
  draw wire from R1 right to D1 left
```

Problem: Wire Lang source declares electrical connections, not drawing paths.

Better:

```wire
schematic
  component R1 Resistor value=220ohm
  component D1 LED color=red

  connect R1.2, D1.A
```

## Bad: Visible Text As Comment

```wire
schematic
  component D1 LED color=red

  // Status LED
```

Problem: comments are source-only and do not render.

Better:

```wire
schematic
  component D1 LED color=red

  annotation "Status LED" near D1
```

## Good: Local Module Component

```wire
schematic
  title "Soil sensor input"

  define component SoilSensor
    terminal VCC
    terminal GND
    terminal AOUT
    symbol module
  end

  component S1 SoilSensor
  component R1 Resistor value=10k
  component J1 Header pins=[VCC,GND,A0]

  net VCC: J1.VCC, S1.VCC, R1.1
  net GND: J1.GND, S1.GND
  net SENSOR: S1.AOUT, R1.2, J1.A0

  render direction=left-to-right
```

Why this is good:

- The unsupported sensor is modeled as a local module.
- Module terminals are explicit.
- Named nets clarify the public connections.
