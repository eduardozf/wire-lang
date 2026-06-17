import { compile, layout } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

const LED = `schematic
  component BT1 Battery voltage=5V
  component R1 Resistor value=220ohm
  component D1 LED color=red

  net VCC: BT1.+, R1.1
  connect R1.2, D1.A
  net GND: D1.C, BT1.-
  render direction=left-to-right
`;

describe("layout", () => {
  it("places every component and produces a positive-size canvas", () => {
    const { model } = compile(LED);
    const result = layout(model);
    expect(result.components.map((c) => c.id)).toEqual(["BT1", "R1", "D1"]);
    expect(result.size.width).toBeGreaterThan(0);
    expect(result.size.height).toBeGreaterThan(0);
    for (const component of result.components) {
      expect(component.terminals.length).toBeGreaterThan(0);
    }
  });

  it("routes one wire per non-empty net", () => {
    const { model } = compile(LED);
    const result = layout(model);
    expect(result.wires).toHaveLength(3);
    for (const wire of result.wires) {
      expect(wire.segments.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical input", () => {
    const a = layout(compile(LED).model);
    const b = layout(compile(LED).model);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("keeps all coordinates within the reported canvas size", () => {
    const { model } = compile(LED);
    const result = layout(model);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const wire of result.wires) {
      for (const segment of wire.segments) {
        xs.push(segment.from.x, segment.to.x);
        ys.push(segment.from.y, segment.to.y);
      }
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(result.size.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(result.size.height);
  });

  it("rotates the flow axis for top-to-bottom direction", () => {
    const ltr = layout(compile(LED).model);
    const ttb = layout(compile(LED.replace("left-to-right", "top-to-bottom")).model);
    // A horizontal flow is wider than tall; the vertical flow flips that.
    expect(ltr.size.width).toBeGreaterThan(ltr.size.height);
    expect(ttb.size.height).toBeGreaterThan(ttb.size.width);
  });
});
