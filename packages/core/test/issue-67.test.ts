import { compile, layout, renderSvg } from "@wire-lang/core";
import { describe, expect, it } from "vitest";

// Keep the original collision fixture independent of gallery edits.
const divider = `schematic
  title "Potentiometer voltage divider"
  description "A 10k potentiometer taps a fraction of the 5V rail; a rheostat trims the return leg."

  component PWR1 PowerFlag name=5V
  component RV1 Potentiometer value=10k
  component RH1 Rheostat value=4k7
  component G1 GroundReference

  net VCC: PWR1.1, RV1.1
  net OUT: RV1.W, RH1.1
  net GND: RV1.2, RH1.2, G1.GND
`;

function coordinates(value: string): number[] {
  return value.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
}

describe("issue #67: potentiometer contact and labels", () => {
  for (const direction of ["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"]) {
    for (const orientation of ["horizontal", "vertical"]) {
      const source = `${divider}\nrender direction=${direction}\nrender RV1 orientation=${orientation}\n`;
      const name = `${direction}, ${orientation}`;

      it(`keeps labels clear of connections: ${name}`, () => {
        const model = layout(compile(source).model);
        const svg = renderSvg(source);
        const component = svg.match(
          /<g class="wire-component"[^>]*data-wire-id="RV1"[^>]*>(.*?)<\/g>/s,
        )![1]!;
        const labels = [
          ...component.matchAll(
            /<text class="wire-label" x="([^"]+)" y="([^"]+)" text-anchor="([^"]+)">([^<]+)<\/text>/g,
          ),
        ];
        expect(labels).toHaveLength(2);
        for (const [, x, y, anchor, text] of labels) {
          const width = text!.length * 7;
          const left = Number(x) - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0);
          const box = {
            left: left - 2,
            right: left + width + 2,
            top: Number(y) - 11,
            bottom: Number(y) + 2,
          };
          for (const wire of model.wires) {
            for (const { from, to } of wire.segments) {
              const intersects =
                Math.max(from.x, to.x) > box.left &&
                Math.min(from.x, to.x) < box.right &&
                Math.max(from.y, to.y) > box.top &&
                Math.min(from.y, to.y) < box.bottom;
              expect(intersects, `${text} intersects ${wire.net}`).toBe(false);
            }
          }
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(model.size.width);
          expect(box.top).toBeGreaterThanOrEqual(0);
          expect(box.bottom).toBeLessThanOrEqual(model.size.height);
        }
      });

      it(`puts the arrow tip on the resistor track: ${name}`, () => {
        const svg = renderSvg(source);
        const component = svg.match(
          /<g class="wire-component"[^>]*data-wire-id="RV1"[^>]*>(.*?)<\/g>/s,
        )![1]!;
        const track = coordinates(component.match(/<path[^>]* d="([^"]+)"/)![1]!);
        const [x, y] = coordinates(component.match(/<polygon[^>]* points="([^"]+)"/)![1]!);
        let touches = false;
        for (let i = 2; i < track.length; i += 2) {
          const ax = track[i - 2]!;
          const ay = track[i - 1]!;
          const bx = track[i]!;
          const by = track[i + 1]!;
          const cross = (x! - ax) * (by - ay) - (y! - ay) * (bx - ax);
          if (
            Math.abs(cross) < 0.01 &&
            x! >= Math.min(ax, bx) &&
            x! <= Math.max(ax, bx) &&
            y! >= Math.min(ay, by) &&
            y! <= Math.max(ay, by)
          )
            touches = true;
        }
        expect(touches).toBe(true);
      });
    }
  }
});
