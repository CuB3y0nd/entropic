import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export type GitPerson = { name: string; email: string; commit: string; primary: boolean };
type HistoryCache = { head: string; files: Map<string, Promise<readonly GitPerson[]>> };
const repositories = new Map<string, HistoryCache>();

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 30_000
  });
  return stdout;
}

/** Follow each file back to its creation. The first person is its author. */
export async function readGitHistory(files: readonly string[], root = process.cwd()) {
  root = path.resolve(root);
  const [head, shallow] = (await git(root, ["rev-parse", "HEAD", "--is-shallow-repository"])).trim().split("\n");
  if (!head || shallow !== "false") {
    throw new Error("Automatic article credits need complete Git history. Run git fetch --unshallow first.");
  }
  let cache = repositories.get(root);
  if (!cache || cache.head !== head) {
    cache = { head, files: new Map() };
    repositories.set(root, cache);
  }

  const uniqueFiles = new Set(files);
  const pending = uniqueFiles.values();
  const result = new Map<string, readonly GitPerson[]>();
  const worker = async () => {
    for (const file of pending) {
      let history = cache.files.get(file);
      if (!history) {
        history = historyForFile(root, head, file);
        cache.files.set(file, history);
      }
      try {
        result.set(file, await history);
      } catch (error) {
        cache.files.delete(file);
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, uniqueFiles.size) }, worker));
  return result;
}

async function historyForFile(root: string, head: string, file: string): Promise<readonly GitPerson[]> {
  const output = await git(root, [
    "log",
    "--follow",
    "--no-merges",
    "--topo-order",
    "--no-show-signature",
    "--format=%x1e%H%x00%aN%x00%aE%x00%(trailers:key=Co-authored-by,valueonly,unfold,separator=%x1f)",
    head,
    "--",
    file
  ]);
  const people = new Map<string, GitPerson>();
  const append = (person: GitPerson) => {
    const key = person.email.toLowerCase();
    const existing = people.get(key);
    // A later authored commit can identify a coauthor without changing their order.
    if (!existing || (!existing.primary && person.primary)) people.set(key, person);
  };
  // --reverse and --follow do not reliably trace older paths together.
  for (const record of output.split("\x1e").filter(Boolean).reverse()) {
    const [commit, name, email, trailers] = record.trim().split("\0");
    if (!commit || !name || !email) continue;
    append({ name, email, commit, primary: true });
    for (const trailer of trailers?.split("\x1f") ?? []) {
      const match = /^(.*?)\s*<([^<>]+)>$/.exec(trailer.trim());
      if (match?.[1] && match[2]) append({ name: match[1].trim(), email: match[2], commit, primary: false });
    }
  }
  return [...people.values()];
}

export async function githubRepository(root = process.cwd()): Promise<string | undefined> {
  try {
    const remote = (await git(root, ["remote", "get-url", "origin"])).trim();
    const match = /^(?:git@github\.com:|(?:https:\/\/|ssh:\/\/(?:git@)?)github\.com\/)([^/]+\/[^/]+?)(?:\.git)?$/.exec(
      remote
    );
    return match?.[1];
  } catch {
    return undefined;
  }
}
