import { describe, expect, it } from "vitest";
import { countConnectedSubschematics } from "../src/compiler/connectivity.js";

describe("countConnectedSubschematics", () => {
  it("counts one group when every node is reachable", () => {
    expect(
      countConnectedSubschematics(
        ["A", "B", "C"],
        [
          ["A", "B"],
          ["B", "C"],
        ],
      ),
    ).toBe(1);
  });

  it("counts each disconnected piece", () => {
    expect(
      countConnectedSubschematics(
        ["A", "B", "C", "D"],
        [
          ["A", "B"],
          ["C", "D"],
        ],
      ),
    ).toBe(2);
  });

  it("treats a multi-member net as a single hyper-edge", () => {
    expect(countConnectedSubschematics(["A", "B", "C"], [["A", "B", "C"]])).toBe(1);
  });

  it("counts isolated nodes as their own groups", () => {
    expect(countConnectedSubschematics(["A", "B", "C"], [])).toBe(3);
  });

  it("returns zero for an empty graph", () => {
    expect(countConnectedSubschematics([], [])).toBe(0);
  });
});
