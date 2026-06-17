import type { ComponentNode, NetNode } from "@wire-lang/core";
import { parse } from "@wire-lang/core";
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

describe("parse", () => {
  it("parses the canonical LED circuit without diagnostics", () => {
    const result = parse(LED);
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast.kind).toBe("Document");
  });

  it("captures components, types, and properties", () => {
    const result = parse(LED);
    const components = result.ast.statements.filter(
      (s): s is ComponentNode => s.kind === "Component",
    );
    expect(components.map((c) => c.id)).toEqual(["BT1", "R1", "D1"]);
    expect(components.map((c) => c.componentType)).toEqual(["Battery", "Resistor", "LED"]);
    const r1 = components[1]!;
    expect(r1.properties[0]?.name).toBe("value");
    expect(r1.properties[0]?.value.raw).toBe("220ohm");
    expect(r1.properties[0]?.value.valueKind).toBe("quantity");
  });

  it("parses named nets, anonymous connects, and +/- terminals", () => {
    const result = parse(LED);
    const nets = result.ast.statements.filter((s): s is NetNode => s.kind === "Net");
    expect(nets.map((n) => n.name)).toEqual(["VCC", "GND"]);
    const vcc = nets[0]!;
    expect(vcc.members.map((m) => `${m.component}.${m.terminal}`)).toEqual(["BT1.+", "R1.1"]);
  });

  it("parses global render hints with hyphenated values", () => {
    const result = parse(LED);
    const render = result.ast.statements.find((s) => s.kind === "Render");
    expect(render).toBeDefined();
    if (render?.kind === "Render") {
      expect(render.scope).toBe("global");
      expect(render.hintKey).toBe("direction");
      expect(render.hintValue).toBe("left-to-right");
    }
  });

  it("records source locations on nodes", () => {
    const result = parse(LED);
    const first = result.ast.statements[0]!;
    expect(first.range.start.line).toBe(2);
    expect(first.range.start.column).toBe(3);
  });

  it("recovers from an unknown statement with an error node + diagnostic", () => {
    const result = parse(
      `schematic\n  draw wire from R1 to D1\n  component R1 Resistor value=1k\n`,
    );
    expect(result.ok).toBe(false);
    const errorNode = result.ast.statements.find((s) => s.kind === "Error");
    expect(errorNode).toBeDefined();
    // Recovery: the valid component after the bad line is still parsed.
    const component = result.ast.statements.find((s) => s.kind === "Component");
    expect(component).toBeDefined();
    expect(result.diagnostics[0]?.code).toBe("parse.unknown-statement");
  });

  it("flags a missing schematic document kind", () => {
    const result = parse(`component R1 Resistor value=1k\n`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "parse.missing-schematic")).toBe(true);
  });
});
