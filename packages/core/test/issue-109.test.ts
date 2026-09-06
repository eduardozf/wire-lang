import { compile, layout } from "@wire-lang/core";
import { describe, expect, it } from "vitest";
import { collinearOverlaps, foreignTerminalHits } from "./helpers/geometry.js";

const ISSUE_109 = `schematic
  title "ESP32-S3-N16R8 to CC1101 wiring"
  description "Full ESP32-S3-N16R8 pinout wired to a CC1101 sub-GHz transceiver module: 3V3 power, hardware FSPI bus (GPIO10-13), GDO0 (GPIO7) for TX and GDO2 (GPIO21) for RX; all other GPIOs left unconnected."

  component U1 IC pins=[GPIO00@left, GPIO01@left, GPIO02@left, GPIO03@left, GPIO04@left, GPIO05@left, GPIO06@left, GPIO08@left, GPIO09@left, GPIO14@left, GPIO15@left, GPIO16@left, GPIO17@left, GPIO18@left, GPIO19@left, GPIO20@left, GPIO35@left, GPIO36@left, GPIO37@right, GPIO38@right, GPIO39@right, GPIO40@right, GPIO41@right, GPIO42@right, GPIO43@right, GPIO44@right, GPIO45@right, GND@right, 3V3@right, GPIO7@right, GPIO10@right, GPIO12@right, GPIO11@right, GPIO13@right, GPIO21@right]
  component U2 IC pins=[1:GND@left, 2:VCC@left, 3:GDO0@left, 4:CSN@left, 5:MOSI@left, 6:SCK@left, 7:MISO@left, 8:GDO2@left]

  net 3V3: U1.3V3, U2.VCC
  net GND: U1.GND, U2.GND
  net GDO0: U1.GPIO7, U2.GDO0
  net CSN: U1.GPIO10, U2.CSN
  net MOSI: U1.GPIO11, U2.MOSI
  net SCK: U1.GPIO12, U2.SCK
  net MISO: U1.GPIO13, U2.MISO
  net GDO2: U1.GPIO21, U2.GDO2

  annotation "ESP32-S3-N16R8" near U1
  annotation "CC1101" near U2
  render direction=left-to-right
`;

const CROSSED_PINS = `schematic
  component U1 IC pins=[A@right, B@right]
  component U2 IC pins=[X@left, Y@left]
  net N: U1.A, U2.Y
  net M: U1.B, U2.X
  render direction=left-to-right
`;

function totalWireLength(source: string): number {
  const result = layout(compile(source).model);
  return result.wires.reduce(
    (total, wire) =>
      total +
      wire.segments.reduce(
        (wireTotal, segment) =>
          wireTotal +
          Math.abs(segment.from.x - segment.to.x) +
          Math.abs(segment.from.y - segment.to.y),
        0,
      ),
    0,
  );
}

describe("issue #109: facing IC pin routing", () => {
  it("widens an IC body enough for opposing pin labels", () => {
    const schematic = compile(ISSUE_109).model;
    const u1 = layout(schematic).components.find((component) => component.id === "U1")!;
    const bodyWidth = u1.size.width - 28;
    const longestLeft = Math.max(
      ...u1.terminals
        .filter((terminal) => terminal.side === "left")
        .map((terminal) => terminal.name.length),
    );
    const longestRight = Math.max(
      ...u1.terminals
        .filter((terminal) => terminal.side === "right")
        .map((terminal) => terminal.name.length),
    );
    // Resvg's system-font fallback advances these 9 px labels by roughly
    // 6.5 px per character. Reserve another 12 px so the rasterized labels
    // have a visible gap instead of merely touching at their glyph bounds.
    const requiredWidth = (longestLeft + longestRight) * 6.5 + 24;
    expect(bodyWidth).toBeGreaterThanOrEqual(requiredWidth);
  });

  it("does not route a net through foreign terminals in the reported schematic", () => {
    const schematic = compile(ISSUE_109).model;
    expect(foreignTerminalHits(layout(schematic), schematic)).toEqual([]);
  });

  it("keeps the reported schematic compact", () => {
    expect(totalWireLength(ISSUE_109)).toBeLessThan(2_500);
  });

  it("reserves enough space between facing ICs for the wire channels", () => {
    const result = layout(compile(ISSUE_109).model);
    const u1 = result.components.find((component) => component.id === "U1")!;
    const u2 = result.components.find((component) => component.id === "U2")!;
    const u1Right = Math.max(
      ...u1.terminals
        .filter((terminal) => terminal.side === "right")
        .map((terminal) => terminal.point.x),
    );
    const u2Left = Math.min(
      ...u2.terminals
        .filter((terminal) => terminal.side === "left")
        .map((terminal) => terminal.point.x),
    );

    // The router creates nine candidate tracks for eight routes. Ten intervals
    // at its 16 px clearance pitch cover both component edges and every track.
    expect(u2Left - u1Right).toBeGreaterThanOrEqual(10 * 16);
    expect(collinearOverlaps(result)).toEqual([]);
  });

  it("gives distinct nets distinct vertical tracks in the facing channel", () => {
    const result = layout(compile(ISSUE_109).model);
    const u1 = result.components.find((component) => component.id === "U1")!;
    const u2 = result.components.find((component) => component.id === "U2")!;
    const leftEdge = Math.max(...u1.terminals.map((terminal) => terminal.point.x));
    const rightEdge = Math.min(...u2.terminals.map((terminal) => terminal.point.x));
    const tracks = result.wires.flatMap((wire) =>
      wire.segments
        .filter(
          (segment) =>
            segment.from.x === segment.to.x &&
            segment.from.x > leftEdge &&
            segment.from.x < rightEdge,
        )
        .map((segment) => ({ net: wire.net, x: segment.from.x })),
    );
    const reused = tracks.filter(
      (track, index) =>
        tracks.findIndex((other) => other.x === track.x && other.net !== track.net) !== -1 &&
        tracks.findIndex((other) => other.x === track.x && other.net === track.net) === index,
    );

    expect(new Set(tracks.map((track) => track.net)).size).toBe(8);
    expect(reused).toEqual([]);
  });

  it("uses doglegs instead of overlapping wires when pin order is crossed", () => {
    for (const source of [CROSSED_PINS, CROSSED_PINS.replace("left-to-right", "top-to-bottom")]) {
      const schematic = compile(source).model;
      const result = layout(schematic);
      expect(foreignTerminalHits(result, schematic)).toEqual([]);
      expect(collinearOverlaps(result)).toEqual([]);
    }
  });

  it("is deterministic", () => {
    const schematic = compile(ISSUE_109).model;
    expect(JSON.stringify(layout(schematic))).toBe(JSON.stringify(layout(schematic)));
  });
});
