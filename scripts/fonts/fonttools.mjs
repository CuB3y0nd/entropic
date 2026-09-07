import { accessSync, constants, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const uvEnv = {
  ...process.env,
  UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? path.join(os.tmpdir(), "entropic-uv-cache")
};

export function findCommand(command, options = { required: true }) {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(directory, command);

    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep searching PATH.
    }
  }

  if (!options.required) {
    return undefined;
  }

  throw new Error(`Missing ${command}.`);
}

export function pythonFromPyftsubset(pyftsubset) {
  const firstLine = readFileSync(pyftsubset, "utf8").split("\n")[0] ?? "";
  const match = firstLine.match(/^#!(.+)$/);

  if (!match) {
    throw new Error(`Cannot read Python interpreter from ${pyftsubset}`);
  }

  return match[1].trim();
}

export function pyftsubsetCommand() {
  const localPyftsubset = findCommand("pyftsubset", { required: false });

  if (localPyftsubset) {
    return { command: localPyftsubset, prefixArgs: [] };
  }

  const uvx = findCommand("uvx", { required: false }) ?? findCommand("uv", { required: false });

  if (!uvx) {
    throw new Error("Missing pyftsubset. Install fonttools, or install uv to run it with uvx.");
  }

  return path.basename(uvx) === "uvx"
    ? { command: uvx, prefixArgs: ["--from", "fonttools", "pyftsubset"] }
    : {
        command: uvx,
        prefixArgs: ["tool", "run", "--from", "fonttools", "pyftsubset"]
      };
}
