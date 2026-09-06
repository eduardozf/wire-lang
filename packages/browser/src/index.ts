import { renderSvg } from "@wire-lang/core";

export interface RunOptions {
  /** Limit discovery to this document, element, or fragment. */
  root?: ParentNode;
  selector?: string;
  /** Re-render even when the source and output have not changed. */
  force?: boolean;
}

export interface InitializeOptions extends RunOptions {
  /** Wait for DOMContentLoaded and render once. Defaults to true. */
  startOnLoad?: boolean;
}

export interface RenderFailure {
  element: Element;
  error: unknown;
}

export interface RunResult {
  rendered: number;
  errors: RenderFailure[];
}

interface RenderedBlock {
  source: string;
  output: HTMLElement;
  wasHidden: HTMLElement["hidden"];
}

const blocks = new WeakMap<HTMLElement, RenderedBlock>();
const selector = "pre > code.language-wire, pre.wire-lang, code.wire-lang";
let queue: Promise<unknown> = Promise.resolve();

/** Yield to the event loop, then render one diagram. No DOM is required. */
export async function render(source: string): Promise<string> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return renderSvg(source);
}

function defaultDocument(): Document {
  if (typeof document === "undefined") {
    throw new Error("Wire browser rendering requires a document. Pass a DOM root to run().");
  }
  return document;
}

async function renderBlocks(options: RunOptions): Promise<RunResult> {
  const root = options.root ?? defaultDocument();
  const query = options.selector ?? selector;
  const candidates = [...root.querySelectorAll<HTMLElement>(query)];
  // An element passed as root may itself be a source block.
  if ("matches" in root && typeof root.matches === "function" && root.matches(query)) {
    candidates.unshift(root as HTMLElement);
  }
  const sources = new Set(
    candidates.map((node) =>
      node.tagName === "CODE" && node.parentElement?.tagName === "PRE" ? node.parentElement : node,
    ),
  );
  const result: RunResult = { rendered: 0, errors: [] };
  for (const element of sources) {
    const source = element.textContent ?? "";
    const previous = blocks.get(element);
    if (
      !options.force &&
      previous?.source === source &&
      previous.output.parentNode === element.parentNode &&
      element.parentNode !== null
    ) {
      continue;
    }
    try {
      const svg = await render(source);
      if (!element.parentNode || element.textContent !== source) continue;
      const output = element.ownerDocument.createElement("div");
      output.className = "wire-lang-diagram";
      // Only the core renderer's escaped SVG enters the DOM, never source HTML.
      output.innerHTML = svg;
      previous?.output.remove();
      element.after(output);
      blocks.set(element, { source, output, wasHidden: previous?.wasHidden ?? element.hidden });
      element.hidden = true;
      element.removeAttribute("data-wire-error");
      result.rendered += 1;
    } catch (error) {
      previous?.output.remove();
      if (previous) element.hidden = previous.wasHidden;
      blocks.delete(element);
      element.setAttribute(
        "data-wire-error",
        error instanceof Error ? error.message : String(error),
      );
      result.errors.push({ element, error });
    }
  }
  return result;
}

/** Render discovered blocks, preserving source and avoiding duplicate output. */
export function run(options: RunOptions = {}): Promise<RunResult> {
  // Serialize overlapping calls so initialization and manual runs cannot insert
  // two diagrams for the same source. A failed call must not poison the queue.
  const pending = queue.then(() => renderBlocks(options));
  queue = pending.catch(() => undefined);
  return pending;
}

/** Render once after HTML is ready. Call run() again after client navigation. */
export async function initialize(options: InitializeOptions = {}): Promise<RunResult> {
  if (options.startOnLoad === false) return { rendered: 0, errors: [] };
  const root = options.root ?? defaultDocument();
  const doc = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  if (doc?.readyState === "loading") {
    await new Promise<void>((resolve) => {
      doc.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }
  return run(options);
}

export default { initialize, run, render };
