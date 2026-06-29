import { compile } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

const LED = `schematic
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
`;

describe("compile", () => {
  it("compiles the LED circuit with no errors", () => {
    const { model, ok, diagnostics } = compile(LED);
    expect(ok).toBe(true);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(model.title).toBe("LED current limiting circuit");
    expect(model.direction).toBe("left-to-right");
    expect(model.components.map((c) => c.id)).toEqual(["BT1", "R1", "D1"]);
  });

  it("normalizes quantities and resolves terminals/role aliases", () => {
    const { model } = compile(LED);
    const r1 = model.components.find((c) => c.id === "R1")!;
    const value = r1.properties.find((p) => p.name === "value")!;
    expect(value.quantity?.value).toBe(220);
    expect(value.quantity?.unit).toBe("ohm");
    expect(value.display).toBe("220ohm");

    // BT1.+ and D1.A resolve onto valid terminals.
    const vcc = model.nets.find((n) => n.name === "VCC")!;
    expect(vcc.members).toContainEqual({ component: "BT1", terminal: "+" });
  });

  it("merges repeated named nets and generates anonymous nets", () => {
    const { model } = compile(LED);
    const anon = model.nets.filter((n) => n.anonymous);
    expect(anon).toHaveLength(1);
    expect(anon[0]!.members).toEqual([
      { component: "R1", terminal: "2" },
      { component: "D1", terminal: "A" },
    ]);
  });

  it("flags an unknown component type as a fatal error", () => {
    const { ok, diagnostics } = compile(`schematic\n  component X1 Flux capacitance=1F\n`);
    expect(ok).toBe(false);
    expect(diagnostics.some((d) => d.code === "component.unknown-type")).toBe(true);
  });

  it("reports a net conflict when one terminal joins two nets", () => {
    const source = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  net A: R1.1, R2.1
  net B: R1.1, R2.2
`;
    const { ok, diagnostics } = compile(source);
    expect(ok).toBe(false);
    expect(diagnostics.some((d) => d.code === "net.conflict")).toBe(true);
  });

  it("warns on missing recommended properties and unusual designators", () => {
    const { diagnostics } = compile(`schematic\n  component X1 Resistor\n  net N: X1.1, X1.2\n`);
    expect(diagnostics.some((d) => d.code === "component.missing-recommended-property")).toBe(true);
    expect(diagnostics.some((d) => d.code === "component.unusual-designator")).toBe(true);
  });

  it("derives Header terminals from a pin list", () => {
    const { model } = compile(
      `schematic\n  component J1 Header pins=[VCC,GND,SDA,SCL]\n  net P: J1.VCC\n`,
    );
    const j1 = model.components.find((c) => c.id === "J1")!;
    expect(j1.terminals).toEqual(["VCC", "GND", "SDA", "SCL"]);
  });

  it("warns (without erroring) on render hints the renderer does not yet honor", () => {
    const source = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  net N: R1.1, R2.1
  net M: R1.2, R2.2
  render R1 side=left
  render R1 anchor=center
`;
    const { ok, diagnostics } = compile(source);
    expect(ok).toBe(true); // accepted, just not laid out yet
    expect(diagnostics.filter((d) => d.code === "render.not-yet-honored")).toHaveLength(2);
  });

  it("honors orientation without a not-yet-honored warning", () => {
    const source = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  net N: R1.1, R2.1
  net M: R1.2, R2.2
  render R1 orientation=vertical
`;
    const { ok, diagnostics } = compile(source);
    expect(ok).toBe(true);
    expect(diagnostics.filter((d) => d.code === "render.not-yet-honored")).toHaveLength(0);
  });

  it("warns that groups are accepted but not yet laid out", () => {
    const source = `schematic
  component R1 Resistor value=1k
  component R2 Resistor value=1k
  net N: R1.1, R2.1
  net M: R1.2, R2.2
  group Inputs: R1, R2
`;
    const { ok, diagnostics } = compile(source);
    expect(ok).toBe(true);
    expect(diagnostics.some((d) => d.code === "group.not-yet-honored")).toBe(true);
  });

  it("supports local component definitions with module symbol", () => {
    const source = `schematic
  define component SoilSensor
    terminal VCC
    terminal GND
    terminal AOUT
    symbol module
  end

  component S1 SoilSensor
  net V: S1.VCC, S1.GND
`;
    const { model, ok } = compile(source);
    expect(ok).toBe(true);
    const s1 = model.components.find((c) => c.id === "S1")!;
    expect(s1.local).toBe(true);
    expect(s1.terminals).toEqual(["VCC", "GND", "AOUT"]);
    expect(s1.symbol).toBe("module");
  });
});
