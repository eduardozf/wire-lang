// @vitest-environment jsdom
import { renderSvg } from "@wire-lang/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialize, render, run } from "../src/index.js";

const SOURCE = "schematic\n  component R1 Resistor value=220ohm\n";
function block(source = SOURCE, className = "language-wire"): HTMLPreElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = className;
  code.textContent = source;
  pre.append(code);
  document.body.append(pre);
  return pre;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("browser rendering", () => {
  it("returns core SVG asynchronously", async () => {
    const pending = render(SOURCE);
    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toBe(renderSvg(SOURCE));
    await expect(render("bad source")).rejects.toThrow();
  });

  it("discovers Markdown blocks, preserves source, and ignores other languages", async () => {
    const pre = block();
    const other = block("const x = 1", "language-js");
    expect(await run()).toEqual({ rendered: 1, errors: [] });
    expect(pre.hidden).toBe(true);
    expect(pre.textContent).toBe(SOURCE);
    expect(other.hidden).toBe(false);
    expect(pre.nextElementSibling?.innerHTML).toContain('data-wire-id="R1"');
  });

  it("deduplicates concurrent runs and nested matching elements", async () => {
    const pre = block(SOURCE, "wire-lang");
    pre.className = "wire-lang";
    const results = await Promise.all([run(), run(), initialize()]);
    expect(results.map((result) => result.rendered)).toEqual([1, 0, 0]);
    expect(document.querySelectorAll(".wire-lang-diagram")).toHaveLength(1);
    const first = pre.nextElementSibling;
    expect((await run({ force: true })).rendered).toBe(1);
    expect(pre.nextElementSibling).not.toBe(first);
    expect(document.querySelectorAll(".wire-lang-diagram")).toHaveLength(1);
  });

  it("supports a source element as root and rerenders edited source", async () => {
    const pre = block();
    block();
    expect((await run({ root: pre })).rendered).toBe(1);
    pre.firstElementChild!.textContent = SOURCE.replace("R1", "R2");
    expect((await run({ root: pre })).rendered).toBe(1);
    expect(pre.nextElementSibling?.innerHTML).toContain('data-wire-id="R2"');
    expect(document.querySelectorAll(".wire-lang-diagram")).toHaveLength(1);
  });

  it("reports each error, preserves invalid source, and continues rendering", async () => {
    const bad = block("schematic\n  component X1 Flux\n");
    block();
    const result = await run();
    expect(result.rendered).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      element: bad,
      error: {
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "component.unknown-type" }),
        ]),
      },
    });
    expect(bad.hidden).toBe(false);
    expect(bad.hasAttribute("data-wire-error")).toBe(true);
    bad.firstElementChild!.textContent = SOURCE;
    expect((await run()).rendered).toBe(1);
    expect(bad.hasAttribute("data-wire-error")).toBe(false);
  });

  it("removes stale output and reveals source when an edit is invalid", async () => {
    const pre = block();
    await run();
    pre.firstElementChild!.textContent = "invalid";
    expect((await run()).errors).toHaveLength(1);
    expect(pre.hidden).toBe(false);
    expect(document.querySelectorAll(".wire-lang-diagram")).toHaveLength(0);
  });

  it("does not execute markup in diagram labels", async () => {
    block('schematic\n  title "<img src=x onerror=alert(1)>"\n  component R1 Resistor\n');
    expect((await run()).errors).toHaveLength(0);
    expect(document.querySelector("img, script")).toBeNull();
    expect(document.querySelector("svg title")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("waits for HTML readiness and permits manual initialization", async () => {
    const ready = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    try {
      expect(await initialize({ startOnLoad: false })).toEqual({ rendered: 0, errors: [] });
      const pending = initialize();
      const pre = block();
      await Promise.resolve();
      expect(pre.hidden).toBe(false);
      document.dispatchEvent(new Event("DOMContentLoaded"));
      expect((await pending).rendered).toBe(1);
    } finally {
      ready.mockRestore();
    }
  });

  it("recovers from a failed discovery call and supports custom selectors", async () => {
    const pre = block();
    pre.className = "circuit";
    await expect(run({ selector: "[" })).rejects.toThrow();
    expect((await run({ selector: "pre.circuit" })).rendered).toBe(1);
  });
});
