# Example Gallery

These images are generated from the `.wire` files in [examples/](../examples)
using Wire Lang's own renderer. They are useful for README previews, launch
posts, and regression-checking the current visual style.

The MVP renderer is deterministic, but layout is still intentionally modest.
Some routing and label placement will improve in later releases.

Regenerate this gallery with:

```sh
pnpm examples:update
```

## LED Current Limiter

Source: [examples/led.wire](../examples/led.wire)

![LED current limiting circuit](./assets/led-current-limiter.svg)

## RC Low-Pass Filter

Source: [examples/rc-filter.wire](../examples/rc-filter.wire)

![RC low-pass filter](./assets/rc-filter.svg)

## Soil Sensor Input

Source: [examples/soil-sensor.wire](../examples/soil-sensor.wire)

![Soil sensor input](./assets/soil-sensor.svg)

## NPN LED Driver

Source: [examples/npn-led-driver.wire](../examples/npn-led-driver.wire)

![NPN LED driver](./assets/npn-led-driver.svg)

## Standard Symbol Coverage

Source: [examples/kitchen-sink.wire](../examples/kitchen-sink.wire)

![Switched RLC bench demo](./assets/kitchen-sink.svg)

## Bus-Rail Layout

Source: [examples/bus-rail.wire](../examples/bus-rail.wire)

![Bus-rail layout demo](./assets/bus-rail.svg)

## Potentiometer Voltage Divider

Source: [examples/pot-divider.wire](../examples/pot-divider.wire)

![Potentiometer voltage divider](./assets/pot-divider.svg)

## Diode Variants

Source: [examples/diode-variants.wire](../examples/diode-variants.wire)

![Diode variants](./assets/diode-variants.svg)
