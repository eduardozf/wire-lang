import { readFileSync } from "node:fs";
import { compile, layout, renderSvg } from "@wire-lang/core";
import { expect, it } from "vitest";
import { collinearOverlaps, foreignTerminalHits } from "./helpers/geometry.js";

const source = (name: string) =>
  readFileSync(new URL(`../../../examples/${name}.wire`, import.meta.url), "utf8");

it("connects a current-limited Zener bias and reverse-biased photodiode to one ground", () => {
  const result = compile(source("diode-variants"));
  expect(result.diagnostics).toEqual([]);
  const members = (net: string) =>
    result.model.nets
      .find((n) => n.name === net)!
      .members.map((m) => `${m.component}.${m.terminal}`)
      .sort();
  expect(members("LIMITED")).toEqual(["D1.C", "R1.1"]);
  expect(members("BIAS")).toEqual(["D2.C", "D3.C", "R1.2"]);
  expect(members("SENSE")).toEqual(["D3.A", "R2.1"]);
  expect(members("GND")).toEqual(["D2.A", "G1.GND", "R2.2"]);
  const drawing = layout(result.model);
  for (const id of ["D2", "D3"]) {
    const diode = drawing.components.find((c) => c.id === id)!;
    expect(diode.terminals.find((t) => t.name === "C")!.point.y).toBeLessThan(
      diode.terminals.find((t) => t.name === "A")!.point.y,
    );
  }
  expect(drawing.wires.find((w) => w.net === "LIMITED")!.segments).toHaveLength(1);
  expect(renderSvg(result.model)).toContain(">3.3V</text>");
  expect(collinearOverlaps(drawing)).toEqual([]);
  expect(foreignTerminalHits(drawing, result.model)).toEqual([]);
});

it("shows a right-facing divider wiper and its load with a visible OUT label", () => {
  const result = compile(source("pot-divider"));
  expect(result.diagnostics).toEqual([]);
  const drawing = layout(result.model);
  const pot = drawing.components.find((c) => c.id === "RV1")!;
  expect(pot.terminals.find((t) => t.name === "W")!.point.x).toBeGreaterThan(pot.center.x);
  expect(drawing.labels.some((label) => label.text === "OUT")).toBe(true);
  expect(collinearOverlaps(drawing)).toEqual([]);
  expect(foreignTerminalHits(drawing, result.model)).toEqual([]);
});
