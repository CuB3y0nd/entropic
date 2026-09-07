import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCommand, pythonFromPyftsubset, uvEnv } from "./fonttools.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const script = fileURLToPath(new URL("./build-cjk-atlas.py", import.meta.url));
const pyftsubset = findCommand("pyftsubset", { required: false });
const uv = findCommand("uv", { required: false });

if (pyftsubset) {
  const python = pythonFromPyftsubset(pyftsubset);
  execFileSync(python, [script], { cwd: root, stdio: "inherit" });
} else if (uv) {
  execFileSync(uv, ["run", "--script", script], {
    cwd: root,
    env: uvEnv,
    stdio: "inherit"
  });
} else {
  throw new Error("Missing fonttools. Install pyftsubset, or install uv.");
}
