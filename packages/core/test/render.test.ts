import { renderSvg, WireLangError } from "@wire-lang/core";
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

describe("renderSvg", () => {
  it("renders a standalone SVG with accessible title and description", () => {
    const svg = renderSvg(LED);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<title>LED current limiting circuit</title>");
    expect(svg).toContain("<desc>A 5V battery drives a red LED through a 220 ohm resistor.</desc>");
    expect(svg).toContain("</svg>");
  });

  it("emits stable data-wire metadata and classes", () => {
    const svg = renderSvg(LED);
    expect(svg).toContain('data-wire-kind="component"');
    expect(svg).toContain('data-wire-id="R1"');
    expect(svg).toContain('data-wire-type="Resistor"');
    expect(svg).toContain('data-wire-net="VCC"');
    expect(svg).toContain('class="wire-component"');
  });

  it("renders real text labels (not paths) for labels and annotations", () => {
    const svg = renderSvg(LED);
    expect(svg).toContain(">220ohm<");
    expect(svg).toContain(">Current limiting resistor<");
  });

  it("is deterministic", () => {
    expect(renderSvg(LED)).toBe(renderSvg(LED));
  });

  it("throws WireLangError with diagnostics on fatal source", () => {
    try {
      renderSvg(`schematic\n  component X1 Flux\n`);
      throw new Error("expected renderSvg to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WireLangError);
      if (error instanceof WireLangError) {
        expect(error.diagnostics.some((d) => d.code === "component.unknown-type")).toBe(true);
      }
    }
  });

  it("escapes XML-significant characters in titles", () => {
    const svg = renderSvg(
      `schematic\n  title "A & B <C>"\n  component R1 Resistor value=1k\n  net N: R1.1, R1.2\n`,
    );
    expect(svg).toContain("<title>A &amp; B &lt;C&gt;</title>");
  });
});
