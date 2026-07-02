import { compile, layout } from "@wire-lang/core";
import { describe, expect, it } from "vitest";
import { componentGeometry, mirrorGeometry, rotateGeometry } from "../src/layout/geometry.js";

const EPS = 0.01;

const TWO_R = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  net N: R1.1, R2.1
  net M: R1.2, R2.2
  render direction=left-to-right
`;

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

  it("places a two-terminal component along the flow axis by default", () => {
    const result = layout(compile(TWO_R).model);
    const r1 = result.components.find((component) => component.id === "R1");
    const [a, b] = r1?.terminals ?? [];
    // Horizontal flow: the two terminals share a y and span x.
    expect(Math.abs((a?.point.y ?? 0) - (b?.point.y ?? 0))).toBeLessThan(EPS);
    expect(Math.abs((a?.point.x ?? 0) - (b?.point.x ?? 0))).toBeGreaterThan(1);
  });

  it("honors orientation=vertical by rotating the part across the flow axis", () => {
    const result = layout(compile(`${TWO_R}  render R1 orientation=vertical\n`).model);
    const r1 = result.components.find((component) => component.id === "R1");
    const [a, b] = r1?.terminals ?? [];
    // Rotated 90°: the terminals now share an x and span y.
    expect(Math.abs((a?.point.x ?? 0) - (b?.point.x ?? 0))).toBeLessThan(EPS);
    expect(Math.abs((a?.point.y ?? 0) - (b?.point.y ?? 0))).toBeGreaterThan(1);
    // Its derived terminal sides follow the rotation: top/bottom, not left/right.
    expect(new Set(r1?.terminals.map((terminal) => terminal.side))).toEqual(
      new Set(["top", "bottom"]),
    );
    // The unrotated R2 stays horizontal.
    const r2 = result.components.find((component) => component.id === "R2");
    const [c, d] = r2?.terminals ?? [];
    expect(Math.abs((c?.point.y ?? 0) - (d?.point.y ?? 0))).toBeLessThan(EPS);
  });

  it("treats an orientation that matches the flow as a no-op", () => {
    const plain = layout(compile(TWO_R).model);
    const matching = layout(compile(`${TWO_R}  render R1 orientation=horizontal\n`).model);
    expect(JSON.stringify(matching)).toBe(JSON.stringify(plain));
  });

  it("is deterministic for an oriented schematic", () => {
    const source = `${TWO_R}  render R1 orientation=vertical\n`;
    expect(JSON.stringify(layout(compile(source).model))).toBe(
      JSON.stringify(layout(compile(source).model)),
    );
  });
});

describe("mirrorGeometry", () => {
  const instanceOf = (source: string, id: string) => {
    const { model } = compile(source);
    const instance = model.components.find((component) => component.id === id);
    if (!instance) throw new Error(`no component ${id}`);
    return instance;
  };

  const RESISTOR = instanceOf("schematic\n  component R1 Resistor value=1k\n", "R1");
  const IC = instanceOf(
    "schematic\n  component U1 IC pins=[1:VCC@left, 2:OUT@right, 3:GND@bottom]\n",
    "U1",
  );

  it("reflects each terminal's main-offset and keeps spans and cross", () => {
    const base = componentGeometry(RESISTOR);
    const mirrored = mirrorGeometry(base);
    expect(mirrored.mainSpan).toBe(base.mainSpan);
    expect(mirrored.crossSpan).toBe(base.crossSpan);
    for (const [index, terminal] of base.terminals.entries()) {
      const twin = mirrored.terminals[index]!;
      expect(twin.name).toBe(terminal.name);
      expect(twin.main).toBeCloseTo(base.mainSpan - terminal.main, 6);
      expect(twin.cross).toBeCloseTo(terminal.cross, 6);
    }
  });

  it("swaps explicit left/right sides and keeps top/bottom", () => {
    const mirrored = mirrorGeometry(componentGeometry(IC));
    const sideOf = (name: string) =>
      mirrored.terminals.find((terminal) => terminal.name === name)?.side;
    expect(sideOf("VCC")).toBe("right");
    expect(sideOf("OUT")).toBe("left");
    expect(sideOf("GND")).toBe("bottom");
  });

  it("is an involution", () => {
    const base = componentGeometry(IC);
    expect(JSON.stringify(mirrorGeometry(mirrorGeometry(base)))).toBe(JSON.stringify(base));
  });

  it("composes with rotateGeometry to control which terminal ends up on top", () => {
    const base = componentGeometry(RESISTOR);
    // Rotated as-is: the declared first terminal sits on top (negative cross).
    const rotated = rotateGeometry(base);
    expect(rotated.terminals[0]!.cross).toBeLessThan(0);
    expect(rotated.terminals[1]!.cross).toBeGreaterThan(0);
    // Mirrored first: the declared second terminal takes the top instead.
    const flipped = rotateGeometry(mirrorGeometry(base));
    expect(flipped.terminals[0]!.cross).toBeGreaterThan(0);
    expect(flipped.terminals[1]!.cross).toBeLessThan(0);
  });
});
