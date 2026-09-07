import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function checkAstro(source) {
  const root = await mkdtemp(path.join(tmpdir(), "entropic-boundaries-"));
  try {
    await mkdir(path.join(root, "scripts/checks"), { recursive: true });
    await mkdir(path.join(root, "src"));
    await copyFile(
      path.join(projectRoot, "scripts/checks/boundaries.mjs"),
      path.join(root, "scripts/checks/boundaries.mjs")
    );
    await symlink(path.join(projectRoot, "node_modules"), path.join(root, "node_modules"), "dir");
    await writeFile(path.join(root, "entropic.config.ts"), "export default {};\n");
    await writeFile(path.join(root, "src/Page.astro"), source);
    const result = spawnSync(process.execPath, ["scripts/checks/boundaries.mjs"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000
    });
    assert.ifError(result.error);
    return result;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("browser scripts cannot import Node builtins regardless of tag casing", async () => {
  for (const tag of ["script", "SCRIPT", "ScRiPt"]) {
    const result = await checkAstro(`<${tag}>\nimport "node:fs";\n</${tag}>`);
    assert.equal(result.status, 1, `${tag}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /browser dependency reaches node:fs/);
  }
});

test("script extraction respects tag syntax, nesting, and Unicode offsets", async () => {
  for (const source of [
    '<script>import "node:fs";</script >',
    '<script>import "node:fs";</script data-note="ignored">',
    '<script data-note="a > b">import "node:fs";</script>',
    '<p>幽灵 👻</p><script>import "node:fs";</script>',
    '<main>{true && <section><script>import "node:fs";</script></section>}</main>',
    '<script>console.log("safe");</script><script>import "node:fs";</script>'
  ]) {
    const result = await checkAstro(source);
    assert.equal(result.status, 1, `${source}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /browser dependency reaches node:fs/);
  }
});

test("server imports and script-like text are not browser dependencies", async () => {
  for (const source of [
    '---\nimport "node:fs";\n---\n<div />',
    '<!-- <script>import "node:fs";</script> -->',
    '---\nconst example = `<script>import "node:fs";</script>`;\n---\n<div />',
    "<p>{'<script>import \"node:fs\";</script>'}</p>",
    '<script>import type { Stats } from "node:fs";</script>'
  ]) {
    const result = await checkAstro(source);
    assert.equal(result.status, 0, `${source}: ${result.stdout}${result.stderr}`);
    assert.equal(result.stderr, "");
  }
});

test("invalid Astro cannot silently pass the boundary check", async () => {
  const result = await checkAstro("<script>const = ;</script>");
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /src\/Page\.astro: Unable to parse Astro: Unexpected token/);
});
