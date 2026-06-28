import { compile, layout, renderSvg } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

const SOURCE = `schematic
  component U1 IC pins=[1:VCC@left, 2:GND@left, 3:SCL@right, 4:SDA@right, 5:INT@right]
  component U2 IC pins=[1:3V3@left, 2:GND@left, 3:SCL@left, 4:SDA@left, 5:IRQ@left, 6:BTN@left, 7:DRIVE@right, 8:FAULT@right]
  component U3 IC pins=[1:VIN@left, 2:GND@left, 3:IN@left, 4:FAULT@left]
  component SW1 PushButton

  net VCC: U1.VCC, U2.3V3, U3.VIN
  net GND: U1.GND, U2.GND, U3.GND, SW1.2
  net SCL: U1.SCL, U2.SCL
  net SDA: U1.SDA, U2.SDA
  net INT: U1.INT, U2.IRQ
  net DRIVE: U2.DRIVE, U3.IN
  net FAULT: U3.FAULT, U2.FAULT
  net BTN: SW1.1, U2.BTN
  render layout=bus-rail
`;

const EPS = 0.01;

describe("layout: bus-rail", () => {
  it("parses the layout hint and defaults to flow", () => {
    expect(compile("schematic\n  component R1 Resistor value=1k\n").model.layout).toBe("flow");
    const result = compile(SOURCE);
    expect(result.diagnostics).toEqual([]);
    expect(result.model.layout).toBe("bus-rail");
  });

  it("warns on an invalid layout value", () => {
    const { diagnostics, ok } = compile(
      "schematic\n  component R1 Resistor value=1k\n  render layout=spiral\n",
    );
    expect(ok).toBe(true);
    expect(diagnostics.some((d) => d.code === "render.invalid-value")).toBe(true);
  });

  it("draws a supply rail on top and a ground rail on the bottom with tapped dots", () => {
    const model = layout(compile(SOURCE).model);
    const supply = model.wires.find((wire) => wire.net === "VCC");
    const ground = model.wires.find((wire) => wire.net === "GND");
    expect(supply?.color).toBeTruthy();
    expect(ground?.color).toBeTruthy();
    // Every member taps the rail, so there is a junction dot per terminal.
    expect(supply!.junctions.length).toBe(3);
    expect(ground!.junctions.length).toBe(4);
    // The supply rail sits above the ground rail.
    const supplyY = supply!.junctions[0]!.y;
    const groundY = ground!.junctions[0]!.y;
    expect(supplyY).toBeLessThan(groundY);
    // The rails run horizontally.
    expect(supply!.segments.some((s) => Math.abs(s.from.y - s.to.y) < EPS)).toBe(true);
  });

  it("bundles a 3-signal pair into one trunk but leaves a 2-signal pair unbundled", () => {
    const model = layout(compile(SOURCE).model);
    const trunks = model.wires.filter((wire) => wire.net.endsWith("bus"));
    // U1<->U2 shares 3 nets (SCL/SDA/INT) -> one trunk; U2<->U3 shares only
    // 2 (DRIVE/FAULT) -> stays as plain signal lines.
    expect(trunks.length).toBe(1);
    const trunk = trunks[0]!;
    expect(trunk.color).toBeTruthy();
    // The trunk is the thickest wire in the drawing.
    const maxWidth = Math.max(...model.wires.map((wire) => wire.width ?? 0));
    expect(trunk.width).toBe(maxWidth);
  });

  it("converges every tap to one shared entry point per side", () => {
    const model = layout(compile(SOURCE).model);
    // Bus tap wires carry the trunk color but are not the trunk itself.
    const trunkColor = model.wires.find((wire) => wire.net.endsWith("bus"))!.color;
    const taps = model.wires.filter(
      (wire) => wire.color === trunkColor && !wire.net.endsWith("bus"),
    );
    expect(taps.length).toBe(3);
    // Each tap is [horizontal lead, spoke in, spoke out, horizontal lead].
    const apexIn = taps.map((tap) => tap.segments[1]!.to);
    const apexOut = taps.map((tap) => tap.segments[2]!.from);
    for (const point of apexIn) {
      expect(Math.abs(point.x - apexIn[0]!.x)).toBeLessThan(EPS);
      expect(Math.abs(point.y - apexIn[0]!.y)).toBeLessThan(EPS);
    }
    for (const point of apexOut) {
      expect(Math.abs(point.x - apexOut[0]!.x)).toBeLessThan(EPS);
      expect(Math.abs(point.y - apexOut[0]!.y)).toBeLessThan(EPS);
    }
    // The leads out of the pins are horizontal.
    for (const tap of taps) {
      expect(Math.abs(tap.segments[0]!.from.y - tap.segments[0]!.to.y)).toBeLessThan(EPS);
    }
  });

  it("uses hop crossings and a monospace label profile", () => {
    const model = layout(compile(SOURCE).model);
    expect(model.crossings).toBe("hop");
    expect(model.monospace).toBe(true);
    const svg = renderSvg(compile(SOURCE).model);
    expect(svg).toContain("monospace");
  });

  it("produces stable SVG output (snapshot)", () => {
    expect(renderSvg(compile(SOURCE).model)).toMatchSnapshot();
  });
});
