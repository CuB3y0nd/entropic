import { execFileSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pyftsubsetCommand, uvEnv } from "./lib/fonttools.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const asciiSourceFont = path.join(root, "fonts/gohu.woff");
const asciiOutputFont = path.join(root, "public/fonts/gohu-subset.woff");
const pyftsubset = pyftsubsetCommand();

if (!existsSync(asciiSourceFont)) {
  throw new Error(`Missing source font: ${path.relative(root, asciiSourceFont)}`);
}

await fs.mkdir(path.dirname(asciiOutputFont), { recursive: true });
subsetAsciiFont();

function subsetAsciiFont() {
  runPyftsubset([
    asciiSourceFont,
    `--output-file=${asciiOutputFont}`,
    "--unicodes=U+0000-00FF,U+03BB,U+2190-21FF,U+2500-259F,U+25A0-25FF,U+2600-26FF",
    "--layout-features=*",
    "--flavor=woff"
  ]);
}

function runPyftsubset(args) {
  execFileSync(pyftsubset.command, [...pyftsubset.prefixArgs, ...args], {
    env: uvEnv,
    stdio: "inherit"
  });
}
