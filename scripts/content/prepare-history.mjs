import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", timeout: 30_000 }).trim();
const { VERCEL_GIT_PROVIDER: provider, VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: repo } = process.env;

// Some deployment checkouts include Git objects without an origin remote.
if (provider === "github" && owner && repo && !git("remote").split("\n").includes("origin")) {
  git("remote", "add", "origin", `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`);
}

// Hosting providers may supply only recent commits. Attribution needs the first.
if (git("rev-parse", "--is-shallow-repository") === "true") {
  execFileSync("git", ["fetch", "--unshallow", "--no-tags", "origin", git("rev-parse", "HEAD")], {
    stdio: "inherit",
    timeout: 120_000
  });
}
