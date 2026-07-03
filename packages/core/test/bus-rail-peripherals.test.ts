import { compile, layout } from "@wire-lang/core";
import { describe, expect, it } from "vitest";
import { collinearOverlaps } from "./helpers/geometry.js";

// A generic "MCU + amp + peripherals" schematic: an LED chain on one GPIO, a
// push-button on another, an I2S-style 3-net bus to the amp, and a speaker
// bridged across the amp's two output pins.
const KIT = `schematic
  define component MCU
    terminal VCC
    terminal GND
    terminal GPIO2
    terminal GPIO4
    terminal GPIO5
    terminal GPIO6
    terminal GPIO7
    symbol module
  end
  define component AMP
    terminal VIN
    terminal GND
    terminal BCLK
    terminal LRC
    terminal DIN
    terminal OUTP
    terminal OUTN
    symbol module
  end

  component U1 MCU
  component A1 AMP
  component R1 Resistor value=220ohm
  component D1 LED color=red
  component BTN1 PushButton
  component LS1 Speaker

  net VCC: U1.VCC, A1.VIN
  net BCLK: U1.GPIO4, A1.BCLK
  net LRC: U1.GPIO5, A1.LRC
  net DIN: U1.GPIO6, A1.DIN

  net LED_DRIVE: U1.GPIO2, R1.1
  connect R1.2, D1.A
  net BTN_SENSE: U1.GPIO7, BTN1.1
  net SPK_P: A1.OUTP, LS1.+
  net SPK_N: A1.OUTN, LS1.-

  net GND: U1.GND, A1.GND, D1.C, BTN1.2
  render layout=bus-rail
`;

const COL_GAP = 150;
const EPS = 0.01;

function build(source: string) {
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  return layout(result.model);
}

function componentOf(model: ReturnType<typeof build>, id: string) {
  const component = model.components.find((candidate) => candidate.id === id);
  if (!component) throw new Error(`no component ${id}`);
  return component;
}

function terminalPoint(model: ReturnType<typeof build>, id: string, name: string) {
  const terminal = componentOf(model, id).terminals.find((candidate) => candidate.name === name);
  if (!terminal) throw new Error(`no terminal ${id}.${name}`);
  return terminal.point;
}

describe("bus-rail peripherals", () => {
  it("hangs a chain below its anchor pin instead of extending the row", () => {
    const model = build(KIT);
    const gpio2 = terminalPoint(model, "U1", "GPIO2");
    const r1 = componentOf(model, "R1");
    const d1 = componentOf(model, "D1");
    const rowBottom = Math.max(
      ...["U1", "A1"].map((id) => {
        const c = componentOf(model, id);
        return c.position.y + c.size.height;
      }),
    );
    const ground = model.wires.find((wire) => wire.net.includes("GND"))!;
    const groundY = ground.junctions[0]!.y;

    // The chain sits under the pin that feeds it, resistor first, LED second,
    // between the row and the ground rail.
    expect(Math.abs(r1.center.x - gpio2.x)).toBeLessThan(1);
    expect(Math.abs(d1.center.x - gpio2.x)).toBeLessThan(1);
    expect(r1.center.y).toBeGreaterThan(rowBottom);
    expect(d1.center.y).toBeGreaterThan(r1.center.y);
    expect(d1.center.y).toBeLessThan(groundY);

    // The anchor net stays local instead of spanning the canvas.
    const drive = model.wires.find((wire) => wire.net === "LED_DRIVE")!;
    const xs = drive.segments.flatMap((segment) => [segment.from.x, segment.to.x]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(COL_GAP);
  });

  it("auto-flips chain parts so polarity faces the feed (anode toward the resistor)", () => {
    const model = build(KIT);
    const anode = terminalPoint(model, "D1", "A");
    const cathode = terminalPoint(model, "D1", "C");
    expect(anode.y).toBeLessThan(cathode.y);
  });

  it("bridges a speaker across the amp's output pins, + facing OUTP", () => {
    const model = build(KIT);
    const outp = terminalPoint(model, "A1", "OUTP");
    const plus = terminalPoint(model, "LS1", "+");
    const minus = terminalPoint(model, "LS1", "-");
    // The part hangs under the first output pin with the matching polarity up.
    expect(Math.abs(plus.x - outp.x)).toBeLessThan(1);
    expect(plus.y).toBeLessThan(minus.y);
    // Both feeds stay local to the amp's column.
    for (const net of ["SPK_P", "SPK_N"]) {
      const wire = model.wires.find((candidate) => candidate.net === net)!;
      const xs = wire.segments.flatMap((segment) => [segment.from.x, segment.to.x]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(COL_GAP);
    }
  });

  it("treats a button as a chain and keeps its net control-colored", () => {
    const model = build(KIT);
    const btn = componentOf(model, "BTN1");
    const u1 = componentOf(model, "U1");
    expect(btn.center.y).toBeGreaterThan(u1.position.y + u1.size.height);
    const sense = model.wires.find((wire) => wire.net === "BTN_SENSE")!;
    expect(sense.color).toBe("#1d4ed8");
  });

  it("taps chain tails into the ground rail like any other member", () => {
    const model = build(KIT);
    const ground = model.wires.find((wire) => wire.net.includes("GND"))!;
    // U1.GND, A1.GND, D1.C, BTN1.2 all tap the rail.
    expect(ground.junctions.length).toBe(4);
  });

  it("never renders two distinct non-bus nets collinear", () => {
    // Bus leads out of bottom-edge module pins still share the pin-row height
    // (their funnel is drawn per-link); the lane-stagger work covers those, so
    // this invariant holds for everything except bus-bundled wires.
    const busNets = new Set(["BCLK", "LRC", "DIN", "U1-A1 bus"]);
    const hits = collinearOverlaps(build(KIT)).filter(
      (hit) => !busNets.has(hit.a) && !busNets.has(hit.b),
    );
    expect(hits).toEqual([]);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(build(KIT))).toBe(JSON.stringify(build(KIT)));
  });

  it("leaves a two-anchor series part in the row", () => {
    const model = build(`schematic
  component U1 IC pins=[1:OUT@right, 2:GND@left]
  component U2 IC pins=[1:IN@left, 2:GND@left]
  component R1 Resistor value=1k
  net A: U1.OUT, R1.1
  net B: R1.2, U2.IN
  net GND: U1.GND, U2.GND
  render layout=bus-rail
`);
    const r1 = componentOf(model, "R1");
    const u1 = componentOf(model, "U1");
    // Same baseline as the row blocks, not banded below them.
    expect(Math.abs(r1.center.y - u1.center.y)).toBeLessThan(u1.size.height / 2 + EPS);
  });

  it("leaves a pull-up (supply tail) in the row", () => {
    const model = build(`schematic
  component U1 IC pins=[1:SDA@right, 2:GND@left, 3:VCC@left]
  component U2 IC pins=[1:SDA@left, 2:GND@left, 3:VCC@left]
  component R1 Resistor value=4.7k
  net SDA: U1.SDA, U2.SDA, R1.1
  net VCC: U1.VCC, U2.VCC, R1.2
  net GND: U1.GND, U2.GND
  render layout=bus-rail
`);
    const r1 = componentOf(model, "R1");
    const u1 = componentOf(model, "U1");
    expect(Math.abs(r1.center.y - u1.center.y)).toBeLessThan(u1.size.height / 2 + EPS);
  });
});
