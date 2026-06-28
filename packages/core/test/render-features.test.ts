import type { LayoutModel, Segment } from "@wire-lang/core";
import { compile, layout, renderSvg } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

const EPS = 0.01;

/** Length of the 1-D overlap of `[a0,a1]` and `[b0,b1]` (negative if disjoint). */
function overlapLength(a0: number, a1: number, b0: number, b1: number): number {
  return (
    Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1))
  );
}

/**
 * Pairs of segments from *different* nets that render exactly collinear and
 * overlapping — two distinct connections drawn as one line.
 */
function collinearOverlaps(model: LayoutModel): { a: string; b: string; length: number }[] {
  const segs: { net: string; segment: Segment }[] = [];
  for (const wire of model.wires) {
    for (const segment of wire.segments) segs.push({ net: wire.net, segment });
  }
  const hits: { a: string; b: string; length: number }[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]!;
      const b = segs[j]!;
      if (a.net === b.net) continue;
      const sa = a.segment;
      const sb = b.segment;
      const aVert = Math.abs(sa.from.x - sa.to.x) < EPS;
      const bVert = Math.abs(sb.from.x - sb.to.x) < EPS;
      const aHoriz = Math.abs(sa.from.y - sa.to.y) < EPS;
      const bHoriz = Math.abs(sb.from.y - sb.to.y) < EPS;
      let length = 0;
      if (aVert && bVert && Math.abs(sa.from.x - sb.from.x) < EPS) {
        length = overlapLength(sa.from.y, sa.to.y, sb.from.y, sb.to.y);
      } else if (aHoriz && bHoriz && Math.abs(sa.from.y - sb.from.y) < EPS) {
        length = overlapLength(sa.from.x, sa.to.x, sb.from.x, sb.to.x);
      }
      if (length > EPS) hits.push({ a: a.net, b: b.net, length });
    }
  }
  return hits;
}

describe("layout/render features", () => {
  it("places junction dots at interior taps of a 3-way net", () => {
    const source = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  component R3 Resistor value=1k
  net BUS: R1.1, R2.1, R3.1
  net GND: R1.2, R2.2, R3.2
`;
    const result = layout(compile(source).model);
    const junctions = result.wires.flatMap((wire) => wire.junctions);
    expect(junctions.length).toBeGreaterThanOrEqual(2);
  });

  it("fans overlapping drops of distinct nets into separate lanes (issue #53)", () => {
    // Several pins on one IC edge, each on a multi-terminal net that routes to
    // the same side, would stack their vertical drops on a single line and read
    // as one wire. Each distinct net must keep its own lane.
    const source = `schematic
  component U1 IC pins=[1:A@left, 2:B@left, 3:C@left, 4:D@left]
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  component R3 Resistor value=1k
  component R4 Resistor value=1k
  net NA: U1.A, R1.1
  net NB: U1.B, R2.1
  net NC: U1.C, R3.1
  net ND: U1.D, R4.1
`;
    const { model } = compile(source);
    expect(collinearOverlaps(layout(model))).toEqual([]);
    // The same source rendered top-to-bottom swaps the axes; lanes must still
    // hold there.
    const vertical = `${source}  render direction=top-to-bottom\n`;
    expect(collinearOverlaps(layout(compile(vertical).model))).toEqual([]);
    expect(renderSvg(model)).toMatchSnapshot();
  });

  it("renders a net as labels when style=label", () => {
    const source = `schematic
  component BT1 Battery voltage=5V
  component R1 Resistor value=1k
  net VCC: BT1.+, R1.1
  net GND: BT1.-, R1.2
  render net VCC style=label
`;
    const { model } = compile(source);
    const result = layout(model);
    const vcc = result.wires.find((wire) => wire.net === "VCC");
    expect(vcc?.style).toBe("label");
    expect(result.labels.some((label) => label.kind === "net-label" && label.text === "VCC")).toBe(
      true,
    );
  });

  it("honors local component symbol role mappings", () => {
    const source = `schematic
  define component MyLed
    terminal positive_leg
    terminal negative_leg
    symbol led
      map anode = positive_leg
      map cathode = negative_leg
    end
  end

  component D1 MyLed
  component R1 Resistor value=220ohm
  net A: R1.2, D1.positive_leg
  net K: D1.negative_leg, R1.1
`;
    const { model, ok } = compile(source);
    expect(ok).toBe(true);
    const d1 = model.components.find((component) => component.id === "D1")!;
    expect(d1.symbol).toBe("led");
    expect(d1.roleMappings).toContainEqual({ role: "anode", terminal: "positive_leg" });
    expect(() => renderSvg(model)).not.toThrow();
  });

  it("renders the complex symbol set (transistor, ground, header, switch, inductor, polarized cap)", () => {
    const svg = renderSvg(`schematic
  title "Symbol coverage"
  component Q1 NPNTransistor
  component R1 Resistor value=1k
  component L1 Inductor inductance=10mH
  component C1 PolarizedCapacitor capacitance=100uF
  component SW1 PushButton
  component J1 Header pins=[VCC,GND]
  component G1 GroundReference
  net VCC: J1.VCC, R1.1
  net B: R1.2, Q1.B
  net C: Q1.C, L1.1
  net OUT: L1.2, C1.+
  net SWN: SW1.1, C1.-
  net GND: Q1.E, G1.GND, J1.GND, SW1.2
`);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('data-wire-symbol="npn-transistor"');
    expect(svg).toContain('data-wire-symbol="ground-reference"');
    expect(svg).toContain('data-wire-symbol="push-button"');
    expect(svg).toMatchSnapshot();
  });

  it("produces stable SVG output (snapshot)", () => {
    const svg = renderSvg(`schematic
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
`);
    expect(svg).toMatchSnapshot();
  });
});
