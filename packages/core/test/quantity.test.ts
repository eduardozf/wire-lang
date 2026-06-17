import { describe, expect, it } from "vitest";
import { parseQuantity } from "@wire-lang/core";

describe("parseQuantity", () => {
  it("parses unit suffixes", () => {
    expect(parseQuantity("220ohm", "resistance")).toMatchObject({ value: 220, unit: "ohm" });
    expect(parseQuantity("5V", "voltage")).toMatchObject({ value: 5, unit: "V" });
    const nf = parseQuantity("100nF", "capacitance")!;
    expect(nf.unit).toBe("F");
    expect(nf.value).toBeCloseTo(1e-7, 12);
    const mh = parseQuantity("10mH", "inductance")!;
    expect(mh.unit).toBe("H");
    expect(mh.value).toBeCloseTo(0.01, 6);
  });

  it("parses SI prefixes with an implied dimension unit", () => {
    expect(parseQuantity("10k", "resistance")).toMatchObject({ value: 10000, unit: "ohm" });
    expect(parseQuantity("2.2k", "resistance")).toMatchObject({ value: 2200, unit: "ohm" });
  });

  it("parses RKM infix codes", () => {
    expect(parseQuantity("3V3", "voltage")).toMatchObject({ value: 3.3, unit: "V" });
    expect(parseQuantity("4k7", "resistance")).toMatchObject({ value: 4700, unit: "ohm" });
    expect(parseQuantity("1R5", "resistance")).toMatchObject({ value: 1.5, unit: "ohm" });
  });

  it("normalizes the ohm sign and greek omega", () => {
    expect(parseQuantity("220\u03a9", "resistance")).toMatchObject({ value: 220, unit: "ohm" }); // GREEK OMEGA
    expect(parseQuantity("220\u2126", "resistance")).toMatchObject({ value: 220, unit: "ohm" }); // OHM SIGN
  });

  it("preserves the original text as the display label", () => {
    expect(parseQuantity("220ohm")?.display).toBe("220ohm");
  });

  it("returns null for invalid quantities", () => {
    expect(parseQuantity("red")).toBeNull();
    expect(parseQuantity("10xF", "capacitance")).toBeNull();
    expect(parseQuantity("")).toBeNull();
  });
});
