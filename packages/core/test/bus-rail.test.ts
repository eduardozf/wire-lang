import { compile, layout, renderSvg } from "@wire-lang/core";
import { describe, expect, it } from "vitest";
import { collinearOverlaps } from "./helpers/geometry.js";

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

describe("layout: bus-rail lanes", () => {
  const build = (source: string) => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    return layout(result.model);
  };

  it("packs channels: overlapping nets get distinct levels, disjoint nets share one", () => {
    const model = build(`schematic
  define component M4
    terminal A
    terminal B
    terminal C
    terminal D
    symbol module
  end
  component U1 M4
  component U2 M4
  net P: U1.A, U2.A
  net Q: U1.B, U2.B
  net R: U1.C, U1.D
  net S: U2.C, U2.D
  render layout=bus-rail
`);
    const trunkY = (net: string) => {
      const wire = model.wires.find((candidate) => candidate.net === net)!;
      return wire.segments[0]!.from.y;
    };
    // P, Q, and R pairwise overlap in x, so they take three distinct levels.
    const levels = [trunkY("P"), trunkY("Q"), trunkY("R")];
    expect(new Set(levels.map((y) => Math.round(y))).size).toBe(3);
    // S is clear of P (P ends at U2's first pin), so it reuses a level instead
    // of opening a fourth.
    const all = new Set([...levels, trunkY("S")].map((y) => Math.round(y)));
    expect(all.size).toBe(3);
  });

  it("staggers rail hooks so two hooked pins never share a path", () => {
    const model = build(`schematic
  define component PWR
    terminal VCC
    terminal V5
    terminal GND
    symbol module
  end
  component U1 PWR
  component U2 PWR
  net VCC: U1.VCC, U2.VCC
  net 5V: U1.V5, U2.V5
  net GND: U1.GND, U2.GND
  render layout=bus-rail
`);
    const supply = model.wires.find((wire) => wire.net.includes("VCC"))!;
    // Both supply pins of each module hook around to the top rail; every
    // junction lands at its own x.
    const xs = supply.junctions.map((point) => Math.round(point.x));
    expect(new Set(xs).size).toBe(xs.length);
    expect(collinearOverlaps(model)).toEqual([]);
  });

  it("hooks a side-pin rail drop out of the box when it would slice through pins below", () => {
    const model = build(`schematic
  component U1 IC pins=[1:SDA@right, 2:SCL@right, 3:GND@left]
  component U2 IC pins=[1:GND@left, 2:SDA@left, 3:SCL@left]
  net SDA: U1.SDA, U2.SDA
  net SCL: U1.SCL, U2.SCL
  net GND: U1.GND, U2.GND
  render layout=bus-rail
`);
    const u2 = model.components.find((component) => component.id === "U2")!;
    const ground = model.wires.find((wire) => wire.net.includes("GND"))!;
    // U2's GND pin sits above its SDA/SCL pins on the same edge, so its drop
    // breaks out left of the box instead of running through them.
    expect(ground.junctions.some((point) => point.x < u2.position.x - 1)).toBe(true);
    // The two corridor nets keep distinct verticals and nothing overlaps.
    const midX = (net: string) => {
      const wire = model.wires.find((candidate) => candidate.net === net)!;
      const vertical = wire.segments.find(
        (segment) => Math.abs(segment.from.x - segment.to.x) < 0.01,
      )!;
      return vertical.from.x;
    };
    expect(Math.abs(midX("SDA") - midX("SCL"))).toBeGreaterThan(1);
    expect(collinearOverlaps(model)).toEqual([]);
  });
});
