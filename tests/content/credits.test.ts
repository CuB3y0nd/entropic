import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readGitHistory } from "../../src/features/philes/data/git-history";
import { githubCredit, githubLogin } from "../../src/features/philes/data/github";

test("article history preserves the creator across renames, deduplicates revisions, and includes coauthors", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "entropic-history-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  const commit = (name: string, email: string, message: string) => {
    git("add", ".");
    git("-c", "commit.gpgsign=false", "commit", "--author", `${name} <${email}>`, "-m", message);
  };
  try {
    git("init", "-q");
    git("config", "user.name", "Merger");
    git("config", "user.email", "merger@example.test");
    await writeFile(path.join(root, "before.phile"), "one\ntwo\nthree\nfour\n");
    commit("Original", "original@example.test", "First article");
    await rename(path.join(root, "before.phile"), path.join(root, "after.phile"));
    commit("Original", "original@example.test", "Rename article");
    await writeFile(path.join(root, "after.phile"), "one\ntwo\nthree\nfour\nfive\n");
    commit("Editor", "editor@example.test", "Revise article\n\nCo-authored-by: Helper <helper@example.test>");
    const names = async () => (await readGitHistory(["after.phile"], root)).get("after.phile")?.map((p) => p.name);
    assert.deepEqual(await names(), ["Original", "Editor", "Helper"]);
    await writeFile(path.join(root, "after.phile"), "one\ntwo\nthree\nfour\nfive\nsix\n");
    commit("Original", "original@example.test", "Author revision");
    assert.deepEqual(await names(), ["Original", "Editor", "Helper"]);
    await writeFile(path.join(root, "after.phile"), "one\ntwo\nthree\nfour\nfive\nsix\nseven\n");
    commit("Later", "later@example.test", "Later revision");
    assert.deepEqual(await names(), ["Original", "Editor", "Helper", "Later"]);
    await writeFile(path.join(root, "after.phile"), "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n");
    commit("Helper", "helper@example.test", "A coauthor's own revision");
    const people = (await readGitHistory(["after.phile"], root)).get("after.phile");
    assert.deepEqual(
      people?.map((person) => person.name),
      ["Original", "Editor", "Helper", "Later"]
    );
    assert.equal(people?.[2]?.primary, true);
    assert.equal(people?.[2]?.commit, git("rev-parse", "HEAD").trim());
    assert.deepEqual((await readGitHistory(["uncommitted.phile"], root)).get("uncommitted.phile"), []);
    const shallow = path.join(root, "shallow");
    git("clone", "--quiet", "--depth=1", pathToFileURL(root).href, shallow);
    await assert.rejects(readGitHistory(["after.phile"], shallow), /complete Git history/);
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../../scripts/content/prepare-history.mjs", import.meta.url))],
      {
        cwd: shallow,
        stdio: "pipe"
      }
    );
    assert.deepEqual(
      (await readGitHistory(["after.phile"], shallow)).get("after.phile")?.map((p) => p.name),
      ["Original", "Editor", "Helper", "Later"]
    );
    const vercel = path.join(root, "vercel");
    git("clone", "--quiet", "--depth=1", pathToFileURL(root).href, vercel);
    const deploymentGit = (...args: string[]) => execFileSync("git", ["-C", vercel, ...args], { encoding: "utf8" });
    const head = deploymentGit("rev-parse", "HEAD");
    deploymentGit("remote", "remove", "origin");
    deploymentGit("config", `url.${pathToFileURL(root).href}.insteadOf`, "https://github.com/example/site.git");
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../../scripts/content/prepare-history.mjs", import.meta.url))],
      {
        cwd: vercel,
        stdio: "pipe",
        env: {
          ...process.env,
          VERCEL_GIT_PROVIDER: "github",
          VERCEL_GIT_REPO_OWNER: "example",
          VERCEL_GIT_REPO_SLUG: "site"
        }
      }
    );
    assert.equal(deploymentGit("rev-parse", "HEAD"), head);
    assert.deepEqual(
      (await readGitHistory(["after.phile"], vercel)).get("after.phile")?.map((p) => p.name),
      ["Original", "Editor", "Helper", "Later"]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("GitHub identities use nicknames and fall back to logins without guessing from ordinary email addresses", () => {
  assert.equal(githubLogin("117096890+pmc4@users.noreply.github.com"), "pmc4");
  assert.equal(githubLogin("pmc4@users.noreply.github.com"), "pmc4");
  assert.equal(githubLogin("pmc4@example.test"), undefined);
  assert.equal(githubCredit({ login: "pmc4", name: "  A\nNickname  " }).name, "A Nickname");
  assert.equal(githubCredit({ login: "pmc4", name: null }).name, "pmc4");
  assert.equal(githubCredit({ login: "pmc4", name: "  " }).name, "pmc4");
});
