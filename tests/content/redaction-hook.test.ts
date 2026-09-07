import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const hook = fileURLToPath(new URL("../../scripts/hooks/pre-commit", import.meta.url));

test("the hook recognizes YAML redaction with quoted keys, uppercase booleans, and CRLF", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "entropic-hook-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  try {
    git("init", "--quiet");
    const source = '---\r\ntitle: Private\r\n"redacted": TRUE\r\n---\r\nprivate-body-canary\r\n';
    await writeFile(path.join(root, "private.phile"), source);
    await writeFile(path.join(root, "public.phile"), "---\nredacted: false\n---\nPublic\n");
    git("add", "--", "private.phile", "public.phile");
    execFileSync("bash", [hook], { cwd: root, stdio: "pipe" });
    assert.deepEqual(git("diff", "--cached", "--name-only").trim().split("\n"), ["public.phile"]);
    assert.equal(await readFile(path.join(root, "private.phile"), "utf8"), source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
