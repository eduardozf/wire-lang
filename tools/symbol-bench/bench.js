// Symbol bench client. Renders one symbol large on a labeled along/across grid
// and reports the live coordinate under the cursor. Imports the real renderer so
// what you see is exactly what ships.
import {
  compile,
  getStandardComponent,
  layout,
  renderComponent,
  standardComponentNames,
} from "/packages/core/dist/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Representative props to seed the editable Props box, keyed by component type.
// Only list a type here when an example renders better than no props at all
// (Header/IC need pins to draw anything); everything else defaults to "".
const SAMPLE_PROPS = {
  LED: "color=red",
  Resistor: "value=1k",
  Capacitor: "capacitance=100nF",
  PolarizedCapacitor: "capacitance=10uF",
  Inductor: "inductance=10mH",
  Battery: "voltage=9V",
  SPSTSwitch: "state=closed",
  PushButton: "normally=open",
  TVSDiode: "bidirectional=true",
  TestPoint: "name=TP1",
  PowerFlag: "name=VCC",
  Header: "pins=[A,B,C]",
  IC: "pins=[1:VCC@left, 2:GND@left, 3:OUT@right]",
};

// symbol -> a representative one-component schematic (no nets needed; layout
// still places terminals). The list is derived from the standard library, so
// new component types appear automatically. `props` seeds the editable box.
const SYMBOLS = standardComponentNames().map((type) => ({
  type,
  symbol: getStandardComponent(type).symbol,
  props: SAMPLE_PROPS[type] ?? "",
}));

const els = {
  symbol: document.getElementById("symbol"),
  props: document.getElementById("props"),
  canvas: document.getElementById("canvas"),
  hud: document.getElementById("hud"),
  toast: document.getElementById("toast"),
  note: document.getElementById("note"),
};

for (const entry of SYMBOLS) {
  const option = document.createElement("option");
  option.value = entry.symbol;
  option.textContent = `${entry.symbol}  (${entry.type})`;
  els.symbol.append(option);
}

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text != null) node.textContent = text;
  return node;
}

const round = (n) => Math.round(n * 10) / 10;
const niceNumber = (n) => (Object.is(n, -0) ? 0 : round(n));

// The renderer's frame: along runs first->second terminal, across is the left
// normal. For non-two-terminal symbols we fall back to absolute x/y.
function makeFrame(component) {
  const [a, b] = component.terminals;
  if (a && b && component.terminals.length === 2) {
    const dx = b.point.x - a.point.x;
    const dy = b.point.y - a.point.y;
    const length = Math.hypot(dx, dy) || 1;
    const axisX = dx / length;
    const axisY = dy / length;
    return {
      mode: "along/across",
      origin: a.point,
      axisX,
      axisY,
      sideX: -axisY,
      sideY: axisX,
      length,
    };
  }
  return { mode: "x/y", origin: { x: 0, y: 0 }, axisX: 1, axisY: 0, sideX: 0, sideY: 1, length: 0 };
}

const toAbs = (f, along, across) => ({
  x: f.origin.x + f.axisX * along + f.sideX * across,
  y: f.origin.y + f.axisY * along + f.sideY * across,
});
const toLocal = (f, pt) => ({
  along: (pt.x - f.origin.x) * f.axisX + (pt.y - f.origin.y) * f.axisY,
  across: (pt.x - f.origin.x) * f.sideX + (pt.y - f.origin.y) * f.sideY,
});

let frame = null; // current frame, used by the hover handler

function render(symbol, props) {
  const entry = SYMBOLS.find((s) => s.symbol === symbol) ?? SYMBOLS[0];
  const src = `schematic\n  component X1 ${entry.type} ${props}\n`.trimEnd() + "\n";

  let result;
  try {
    result = compile(src);
  } catch (error) {
    return showError(String(error));
  }
  if (!result.model || !result.model.components.length) {
    return showError(result.diagnostics.map((d) => `${d.severity}: ${d.code} — ${d.message}`).join("\n") || "no component");
  }

  const model = layout(result.model);
  const component = model.components[0];
  frame = makeFrame(component);

  // Visible window in local coordinates.
  const along0 = frame.mode === "along/across" ? -16 : -8;
  const along1 = frame.mode === "along/across" ? frame.length + 16 : model.size.width + 8;
  const across0 = frame.mode === "along/across" ? -34 : -8;
  const across1 = frame.mode === "along/across" ? 34 : model.size.height + 8;

  // viewBox = bounds of the window mapped to absolute space.
  const corners = [
    toAbs(frame, along0, across0),
    toAbs(frame, along1, across0),
    toAbs(frame, along0, across1),
    toAbs(frame, along1, across1),
  ];
  const minX = Math.min(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxX = Math.max(...corners.map((c) => c.x));
  const maxY = Math.max(...corners.map((c) => c.y));

  els.canvas.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  els.canvas.replaceChildren();

  drawGrid(frame, { along0, along1, across0, across1 });

  // The glyph is raw SVG in absolute coords — same space as the grid. Drop the
  // instance-id label (e.g. "X1"): it's not geometry and balloons at this zoom.
  const glyph = el("g");
  glyph.innerHTML = renderComponent(component).replace(/<text class="wire-label"[\s\S]*?<\/text>/g, "");
  els.canvas.append(glyph);

  // Terminal markers.
  for (const terminal of component.terminals) {
    els.canvas.append(el("circle", { class: "term-dot", cx: terminal.point.x, cy: terminal.point.y, r: 1.1 }));
  }
  els.canvas.append(el("circle", { class: "cursor-dot", id: "cursor", cx: -9999, cy: -9999, r: 1 }));

  els.note.textContent =
    frame.mode === "along/across"
      ? `length ≈ ${round(frame.length)} · center = ${round(frame.length / 2)} · across: negative = up. Hover for live coordinates, click to copy.`
      : "This symbol isn't two-terminal, so the grid shows absolute x/y (not along/across).";
}

function drawGrid(f, w) {
  const grid = el("g");
  const labels = el("g");
  const line = (a, b, cls) => {
    const p1 = toAbs(f, a.along, a.across);
    const p2 = toAbs(f, b.along, b.across);
    grid.append(el("line", { class: cls, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
  };

  const startAlong = Math.ceil(w.along0);
  const endAlong = Math.floor(w.along1);
  const startAcross = Math.ceil(w.across0);
  const endAcross = Math.floor(w.across1);

  for (let a = startAlong; a <= endAlong; a += 1) {
    const major = a % 5 === 0;
    line({ along: a, across: w.across0 }, { along: a, across: w.across1 }, a === 0 ? "grid-axis" : major ? "grid-major" : "grid-minor");
    if (major) {
      const p = toAbs(f, a, 0);
      labels.append(el("text", { class: "grid-label", "font-size": 1.3, x: p.x, y: toAbs(f, a, w.across0).y + 4, "text-anchor": "middle" }, String(a)));
    }
  }
  for (let c = startAcross; c <= endAcross; c += 1) {
    const major = c % 5 === 0;
    line({ along: w.along0, across: c }, { along: w.along1, across: c }, c === 0 ? "grid-axis" : major ? "grid-major" : "grid-minor");
    if (major) {
      const p = toAbs(f, w.along0, c);
      labels.append(el("text", { class: "grid-label", "font-size": 1.3, x: p.x + 1.5, y: p.y - 1, "text-anchor": "start" }, String(c)));
    }
  }

  // Body centre line (along = length/2) for two-terminal symbols.
  if (f.mode === "along/across") {
    line({ along: f.length / 2, across: w.across0 }, { along: f.length / 2, across: w.across1 }, "grid-center");
  }

  els.canvas.append(grid, labels);
}

function showError(message) {
  frame = null;
  els.canvas.replaceChildren();
  els.note.textContent = "";
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = message;
  els.canvas.replaceWith(div);
}

// --- Hover / click coordinate readout -------------------------------------
function cursorLocal(event) {
  const ctm = els.canvas.getScreenCTM();
  if (!ctm || !frame) return null;
  const pt = els.canvas.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const abs = pt.matrixTransform(ctm.inverse());
  return { abs, ...toLocal(frame, abs) };
}

els.canvas.addEventListener("mousemove", (event) => {
  const c = cursorLocal(event);
  if (!c) return;
  const ax = niceNumber(c.along);
  const ac = niceNumber(c.across);
  const keyA = frame.mode === "along/across" ? "along" : "x";
  const keyB = frame.mode === "along/across" ? "across" : "y";
  els.hud.textContent = `{ ${keyA}: ${ax}, ${keyB}: ${ac} }`;
  const dot = document.getElementById("cursor");
  if (dot) {
    dot.setAttribute("cx", c.abs.x);
    dot.setAttribute("cy", c.abs.y);
  }
});

els.canvas.addEventListener("click", async (event) => {
  const c = cursorLocal(event);
  if (!c) return;
  const keyA = frame.mode === "along/across" ? "along" : "x";
  const keyB = frame.mode === "along/across" ? "across" : "y";
  const snippet = `{ ${keyA}: ${niceNumber(c.along)}, ${keyB}: ${niceNumber(c.across)} }`;
  try {
    await navigator.clipboard.writeText(snippet);
    toast(`copied ${snippet}`);
  } catch {
    toast(snippet);
  }
});

let toastTimer = null;
function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1400);
}

// --- Controls + live reload -----------------------------------------------
function rerender() {
  render(els.symbol.value, els.props.value.trim());
}

els.symbol.addEventListener("change", () => {
  const entry = SYMBOLS.find((s) => s.symbol === els.symbol.value);
  els.props.value = entry ? entry.props : "";
  rerender();
});
els.props.addEventListener("input", rerender);

els.symbol.value = "led";
els.props.value = "color=red";
rerender();

// Reload when core is rebuilt (server's /version reports dist mtime).
let lastVersion = null;
setInterval(async () => {
  try {
    const version = await (await fetch("/version", { cache: "no-store" })).text();
    if (lastVersion === null) lastVersion = version;
    else if (version !== lastVersion) location.reload();
  } catch {
    /* server gone; ignore */
  }
}, 750);
