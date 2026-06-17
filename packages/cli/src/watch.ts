import { watch } from "node:fs";
import type { CliIo } from "./commands.js";
import { EXIT_USAGE, runRender } from "./commands.js";

/**
 * `wire watch <file> --out <out>` — render once, then re-render on file changes.
 * Resolves with exit code 0 when interrupted (SIGINT/SIGTERM).
 */
export async function runWatch(
  file: string,
  out: string,
  json: boolean,
  io: CliIo,
): Promise<number> {
  await runRender(file, out, json, io);
  io.out(`watching ${file} (press Ctrl-C to stop)`);

  return await new Promise<number>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void runRender(file, out, json, io);
      }, 60);
    };

    let watcher: ReturnType<typeof watch>;
    try {
      watcher = watch(file, trigger);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.err(`error: cannot watch ${file}: ${message}`);
      resolve(EXIT_USAGE);
      return;
    }

    const stop = (): void => {
      if (timer) clearTimeout(timer);
      watcher.close();
      resolve(0);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
