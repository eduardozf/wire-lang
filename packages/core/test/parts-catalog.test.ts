import type { NoConnectNode } from "@wire-lang/core";
import { compile, parse, renderSvg } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

/** Helper: error-severity diagnostic codes for a compiled source. */
function errorCodes(source: string): string[] {
  return compile(source)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.code);
}

describe("parts catalog: new discrete components", () => {
  const twoTerminal: { type: string; id: string; symbol: string; terminals: [string, string] }[] = [
    { type: "FerriteBead", id: "FB1", symbol: "ferrite-bead", terminals: ["1", "2"] },
    { type: "TVSDiode", id: "D1", symbol: "tvs-diode", terminals: ["A", "C"] },
    { type: "Speaker", id: "LS1", symbol: "speaker", terminals: ["+", "-"] },
    { type: "PTC", id: "F1", symbol: "ptc", terminals: ["1", "2"] },
  ];

  for (const part of twoTerminal) {
    it(`resolves ${part.type} with its symbol and terminals`, () => {
      const source = `schematic
  component ${part.id} ${part.type}
  component R1 Resistor value=1k
  net N: R1.1, ${part.id}.${part.terminals[0]}
  net M: R1.2, ${part.id}.${part.terminals[1]}
`;
      const { model, ok } = compile(source);
      expect(ok).toBe(true);
      const instance = model.components.find((c) => c.id === part.id)!;
      expect(instance.symbol).toBe(part.symbol);
      expect(instance.terminals).toEqual(part.terminals);
      expect(() => renderSvg(model)).not.toThrow();
      expect(renderSvg(model)).toContain(`data-wire-symbol="${part.symbol}"`);
    });
  }

  const singleTerminal: { type: string; id: string; symbol: string }[] = [
    { type: "Antenna", id: "ANT1", symbol: "antenna" },
    { type: "TestPoint", id: "TP1", symbol: "test-point" },
    { type: "PowerFlag", id: "PWR1", symbol: "power-flag" },
  ];

  for (const part of singleTerminal) {
    it(`resolves single-terminal ${part.type}`, () => {
      const source = `schematic
  component ${part.id} ${part.type}
  component R1 Resistor value=1k
  net N: R1.1, ${part.id}.1
  net M: R1.2, R2.1
  component R2 Resistor value=2k
`;
      const { model } = compile(source);
      expect(errorCodes(source)).toEqual([]);
      const instance = model.components.find((c) => c.id === part.id)!;
      expect(instance.symbol).toBe(part.symbol);
      expect(instance.terminals).toEqual(["1"]);
      expect(renderSvg(model)).toContain(`data-wire-symbol="${part.symbol}"`);
    });
  }

  it("renders the PowerFlag rail name and keeps it off the default-label stack", () => {
    const source = `schematic
  component PWR1 PowerFlag name=3V3
  component R1 Resistor value=1k
  net VCC: PWR1.1, R1.1
`;
    const { model } = compile(source);
    const flag = model.components.find((c) => c.id === "PWR1")!;
    expect(flag.labels).toEqual([]); // name is drawn inside the flag glyph
    expect(renderSvg(model)).toContain(">3V3<");
  });

  it("renders a bidirectional TVS without error", () => {
    const source = `schematic
  component D1 TVSDiode bidirectional=true
  component R1 Resistor value=1k
  net N: R1.1, D1.A
  net M: R1.2, D1.C
`;
    expect(errorCodes(source)).toEqual([]);
    expect(() => renderSvg(source)).not.toThrow();
  });
});

describe("parts catalog: IC block", () => {
  const IC = `schematic
  component U1 IC pins=[1:VCC@left, 2:GND@left, 3:OUT@right]
  component R1 Resistor value=1k
  component G1 GroundReference
  net VCC: U1.VCC, R1.1
  net OUT: U1.OUT, R1.2
  net GND: U1.GND, G1.GND
`;

  it("derives terminals from pin names and records structured pins", () => {
    const { model, ok } = compile(IC);
    expect(ok).toBe(true);
    const u1 = model.components.find((c) => c.id === "U1")!;
    expect(u1.symbol).toBe("ic");
    expect(u1.terminals).toEqual(["VCC", "GND", "OUT"]);
    expect(u1.pins).toEqual([
      { number: "1", name: "VCC", side: "left" },
      { number: "2", name: "GND", side: "left" },
      { number: "3", name: "OUT", side: "right" },
    ]);
  });

  it("renders both the pin number and the pin name", () => {
    const svg = renderSvg(IC);
    expect(svg).toContain(">VCC<");
    expect(svg).toContain(">OUT<");
    expect(svg).toContain(">1<");
    expect(svg).toContain(">3<");
  });

  it("defaults an omitted side to left and tolerates a missing pin number", () => {
    const { model, ok } = compile(`schematic
  component U1 IC pins=[VCC, GND]
  component R1 Resistor value=1k
  net N: U1.VCC, R1.1
  net M: U1.GND, R1.2
`);
    expect(ok).toBe(true);
    const u1 = model.components.find((c) => c.id === "U1")!;
    expect(u1.pins).toEqual([
      { number: null, name: "VCC", side: "left" },
      { number: null, name: "GND", side: "left" },
    ]);
  });

  it("warns on an invalid pin side", () => {
    const { diagnostics } = compile(`schematic
  component U1 IC pins=[1:VCC@sideways]
  net N: U1.VCC
`);
    expect(diagnostics.some((d) => d.code === "component.invalid-property-value")).toBe(true);
  });
});

describe("parts catalog: no-connect", () => {
  const base = `schematic
  component U1 Header pins=[VCC,GND,NC]
  component R1 Resistor value=1k
  net P: U1.VCC, R1.1
  net Q: U1.GND, R1.2
`;

  it("parses a no-connect statement into the AST", () => {
    const result = parse(`${base}  no-connect U1.NC\n`);
    expect(result.ok).toBe(true);
    const nc = result.ast.statements.find((s): s is NoConnectNode => s.kind === "NoConnect")!;
    expect(nc.members.map((m) => `${m.component}.${m.terminal}`)).toEqual(["U1.NC"]);
  });

  it("records no-connect terminals on the model", () => {
    const { model, ok } = compile(`${base}  no-connect U1.NC\n`);
    expect(ok).toBe(true);
    expect(model.noConnects).toEqual([{ component: "U1", terminal: "NC" }]);
  });

  it("renders an X marker for a no-connect terminal", () => {
    const svg = renderSvg(`${base}  no-connect U1.NC\n`);
    expect(svg).toContain('data-wire-kind="no-connect"');
  });

  it("errors when a terminal is both connected and no-connect", () => {
    const source = `schematic
  component U1 Header pins=[VCC,GND]
  component R1 Resistor value=1k
  net P: U1.VCC, R1.1
  net Q: U1.GND, R1.2
  no-connect U1.VCC
`;
    expect(errorCodes(source)).toContain("no-connect.conflict");
  });

  it("errors on an unknown no-connect terminal or component", () => {
    expect(errorCodes(`${base}  no-connect U1.MISSING\n`)).toContain("no-connect.unknown-terminal");
    expect(errorCodes(`${base}  no-connect ZZ.1\n`)).toContain("no-connect.unknown-component");
  });

  it("warns on a duplicate no-connect", () => {
    const { diagnostics } = compile(`${base}  no-connect U1.NC\n  no-connect U1.NC\n`);
    expect(diagnostics.some((d) => d.code === "no-connect.duplicate")).toBe(true);
  });
});

describe("parts catalog: wire hops", () => {
  const CROSSING = `schematic
  component U1 IC pins=[1:VCC@left, 2:OUT@right]
  component R1 Resistor value=1k
  component R2 Resistor value=2k
  component R3 Resistor value=3k
  net VCC: U1.VCC, R1.1
  net OUT: U1.OUT, R2.1
  net X: R1.2, R3.1
  net Y: R2.2, R3.2
`;

  it("draws a hop arc only when crossings=hop is requested", () => {
    const gap = renderSvg(CROSSING);
    const hop = renderSvg(`${CROSSING}  render crossings=hop\n`);
    expect(gap).not.toContain(" A 4 4 ");
    expect(hop).toContain(" A 4 4 ");
  });

  it("warns on an invalid crossings value", () => {
    const { diagnostics, ok } = compile(`${CROSSING}  render crossings=loop\n`);
    expect(ok).toBe(true);
    expect(diagnostics.some((d) => d.code === "render.invalid-value")).toBe(true);
  });

  it("defaults crossings to gap", () => {
    expect(compile(CROSSING).model.crossings).toBe("gap");
  });
});

describe("parts catalog: snapshot", () => {
  it("renders a mixed-parts schematic stably", () => {
    const svg = renderSvg(`schematic
  title "Parts catalog coverage"
  component U1 IC pins=[1:VCC@left, 2:GND@left, 3:OUT@right, 4:EN@right, 5:NC@right]
  component FB1 FerriteBead
  component D1 TVSDiode
  component LS1 Speaker
  component ANT1 Antenna
  component TP1 TestPoint
  component F1 PTC
  component PWR1 PowerFlag name=5V
  net VCC: PWR1.1, U1.VCC, FB1.1
  net OUT: U1.OUT, F1.1
  net A: FB1.2, D1.A
  net B: D1.C, LS1.+
  net C: LS1.-, F1.2
  net D: U1.EN, ANT1.1
  net E: U1.GND, TP1.1
  no-connect U1.NC
`);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatchSnapshot();
  });
});
