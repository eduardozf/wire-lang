/**
 * Quantity normalization. Unit-bearing property values normalize to an SI
 * magnitude plus a canonical unit, while preserving the original text as a
 * display label.
 */

export type Dimension =
  | "resistance"
  | "capacitance"
  | "inductance"
  | "voltage"
  | "current"
  | "unknown";

export interface Quantity {
  /** Normalized magnitude in canonical SI units. */
  readonly value: number;
  /** Canonical unit symbol, e.g. `ohm`, `F`, `H`, `V`. */
  readonly unit: string;
  readonly dimension: Dimension;
  /** Original source text, used as the default display label. */
  readonly display: string;
}

const PREFIXES: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6, // MICRO SIGN
  μ: 1e-6, // GREEK SMALL LETTER MU
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/** Canonical unit symbol for each dimension. */
const CANONICAL_UNIT: Record<Exclude<Dimension, "unknown">, string> = {
  resistance: "ohm",
  capacitance: "F",
  inductance: "H",
  voltage: "V",
  current: "A",
};

// Accepted letters used inside quantity tokens after normalization: ASCII
// letters plus the two micro signs (MICRO SIGN, GREEK SMALL LETTER MU).
const LETTER_CLASS = "A-Za-z\\u00b5\\u03bc";

/**
 * Fold both omega code points (GREEK CAPITAL OMEGA U+03A9 and OHM SIGN U+2126)
 * down to the ASCII spelling `ohm` so all later matching is ASCII-only.
 */
function normalizeUnits(token: string): string {
  return token.replace(/[\u03a9\u2126]/g, "ohm");
}

/** Map a unit token (any accepted spelling) to canonical unit + dimension. */
function resolveUnit(token: string): { unit: string; dimension: Dimension } | null {
  switch (token) {
    case "ohm":
    case "Ohm":
    case "OHM":
    case "R":
      return { unit: "ohm", dimension: "resistance" };
    case "F":
      return { unit: "F", dimension: "capacitance" };
    case "H":
      return { unit: "H", dimension: "inductance" };
    case "V":
      return { unit: "V", dimension: "voltage" };
    case "A":
      return { unit: "A", dimension: "current" };
    default:
      return null;
  }
}

const UNIT_SUFFIXES = ["ohm", "Ohm", "OHM", "R", "F", "H", "V", "A"];

function dimensionUnit(dimension: Dimension): string {
  return dimension === "unknown" ? "" : CANONICAL_UNIT[dimension];
}

/**
 * Parse a quantity-like token. Returns `null` when the token is not a valid
 * quantity. `expected` supplies the dimension implied by the property (so a
 * bare `10k` on a resistor resolves to ohms).
 */
export function parseQuantity(raw: string, expected: Dimension = "unknown"): Quantity | null {
  const text = normalizeUnits(raw.trim());
  if (text.length === 0) return null;

  // RKM "infix" form: 3V3 -> 3.3 V, 4k7 -> 4.7 kilo, 1R5 -> 1.5 ohm.
  const infix = new RegExp(`^(\\d+)([${LETTER_CLASS}])(\\d+)$`).exec(text);
  if (infix) {
    const intPart = infix[1] as string;
    const letter = infix[2] as string;
    const fracPart = infix[3] as string;
    const magnitude = Number.parseFloat(`${intPart}.${fracPart}`);
    const asUnit = resolveUnit(letter);
    if (asUnit) {
      return { value: magnitude, unit: asUnit.unit, dimension: asUnit.dimension, display: raw };
    }
    const multiplier = PREFIXES[letter];
    if (multiplier !== undefined) {
      return {
        value: magnitude * multiplier,
        unit: dimensionUnit(expected),
        dimension: expected,
        display: raw,
      };
    }
    return null;
  }

  // Suffix form: 220ohm, 100nF, 10k, 5V, 2.2k.
  const suffix = new RegExp(`^(\\d+(?:\\.\\d+)?)([${LETTER_CLASS}]*)$`).exec(text);
  if (!suffix) return null;
  const numberPart = suffix[1] as string;
  const unitPart = suffix[2] as string;
  const magnitude = Number.parseFloat(numberPart);

  if (unitPart === "") {
    return { value: magnitude, unit: dimensionUnit(expected), dimension: expected, display: raw };
  }

  // Split into optional SI prefix + optional unit suffix.
  let unitToken = "";
  for (const candidate of UNIT_SUFFIXES) {
    if (unitPart.endsWith(candidate)) {
      unitToken = candidate;
      break;
    }
  }
  const prefixToken =
    unitToken === "" ? unitPart : unitPart.slice(0, unitPart.length - unitToken.length);
  const multiplier = prefixToken === "" ? 1 : PREFIXES[prefixToken];
  if (multiplier === undefined) {
    return null; // unrecognized prefix, e.g. "10xF"
  }

  if (unitToken === "") {
    // Pure prefix like "10k": unit is implied by the property's dimension.
    return {
      value: magnitude * multiplier,
      unit: dimensionUnit(expected),
      dimension: expected,
      display: raw,
    };
  }

  const resolved = resolveUnit(unitToken);
  if (!resolved) return null;
  return {
    value: magnitude * multiplier,
    unit: resolved.unit,
    dimension: resolved.dimension,
    display: raw,
  };
}
