import type { Diagnostic } from "./diagnostics.js";

/**
 * Public exception thrown by happy-path APIs (such as {@link renderSvg}) when
 * they cannot complete. It carries the structured {@link Diagnostic}s that
 * explain why.
 */
export class WireLangError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(message: string, diagnostics: readonly Diagnostic[]) {
    super(message);
    this.name = "WireLangError";
    this.diagnostics = diagnostics;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, WireLangError.prototype);
  }
}
