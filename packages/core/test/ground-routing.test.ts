import { compile, layout } from "@wire-lang/core";
import { expect, it } from "vitest";

it("approaches a ground terminal from outside its glyph on a lower return rail", () => {
  const result = layout(
    compile(`schematic
    component R1 Resistor value=1k
    component G1 GroundReference
    net GND: R1.2, G1.GND
    render R1 orientation=vertical
  `).model,
  );
  const ground = result.components.find((c) => c.id === "G1")!;
  const terminal = ground.terminals[0]!.point;
  const connections = result.wires
    .flatMap((wire) => wire.segments)
    .filter(
      ({ from, to }) =>
        (from.x === terminal.x && from.y === terminal.y) ||
        (to.x === terminal.x && to.y === terminal.y),
    );
  expect(connections).toHaveLength(1);
  const segment = connections[0]!;
  const other =
    segment.from.x === terminal.x && segment.from.y === terminal.y ? segment.to : segment.from;
  expect(other.y).toBeLessThan(terminal.y);
});
